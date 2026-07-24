/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * All write operations are serialized through this single DO instance,
 * identified by idFromName('kubzik96/genesis-ai').
 *
 * Concurrency serialization: all incoming fetch() calls are queued through
 * a per-instance Promise chain (_withLock).
 *
 * Crash-safe idempotency:
 *   • PENDING is written to DO storage BEFORE the GitHub call.
 *   • After GitHub success, SUCCEEDED + timestamps + run state are written
 *     as one atomic batch put (storage.put(Object)).
 *   • UNKNOWN is written after an indeterminate result.
 *
 * Result contract includes githubStatus + idempotencyState for S-0002 §4.8 audit.
 *
 * Storage key schema:
 *   idem:{idempotencyKey}  — idempotency record
 *   rate:timestamps        — array of write timestamp ms values (rolling hour)
 *   run:{runId}            — per-run_id state
 */
import { evaluateIdempotency, markFailed, markSucceeded, markUnknown, isDeterministicClientError } from './idempotency.js';
import { checkHourlyWriteLimit, checkRunBounds, assertAssignIssueBelongsToRun } from './rate-limit.js';
import { createGithubClient, mapGithubError } from './github-client.js';
import { FIXED_FULL_NAME, IDEM_STATES } from './constants.js';

export class BrokerDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this._queue = Promise.resolve();
  }

  _withLock(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async fetch(request) {
    if (!this.state?.storage) {
      return this._json({
        status: 503,
        body: { error: 'BLOCKED', message: 'DO storage unavailable; write blocked' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    const github = createGithubClient({ pat: this.env?.GITHUB_PAT, fetchImpl: this.env?._fetchImpl });
    if (!github) {
      return this._json({
        status: 503,
        body: { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT not available in Durable Object' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return this._json({
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON' },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }
    return this._withLock(() => this._processWrite(payload, github));
  }

  async _processWrite({ idempotencyKey, requestHash, operation, runId, gate, operationData }, github) {
    const storage = this.state.storage;

    const existing = (await storage.get(`idem:${idempotencyKey}`)) ?? null;
    const decision = evaluateIdempotency(existing, requestHash);

    if (decision.action === 'CONFLICT' || decision.action === 'BLOCKED' || decision.action === 'IN_FLIGHT') {
      let idempotencyState = null;
      if (decision.action === 'IN_FLIGHT') idempotencyState = IDEM_STATES.PENDING;
      else if (decision.action === 'BLOCKED' && decision.error === 'BLOCKED_RECONCILIATION_REQUIRED') {
        idempotencyState = IDEM_STATES.UNKNOWN;
      }
      return this._json({
        status: decision.status,
        body: { error: decision.error, message: decision.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState,
      });
    }
    if (decision.action === 'REPLAY') {
      return this._json({
        status: decision.state === IDEM_STATES.FAILED ? decision.result?.status || 400 : 200,
        body: decision.result,
        githubCalled: false,
        githubStatus: null,
        idempotencyState: decision.state,
        replay: true,
      });
    }

    const timestamps = (await storage.get('rate:timestamps')) ?? [];
    const rate = checkHourlyWriteLimit(timestamps);
    if (!rate.ok) {
      return this._json({
        status: rate.status,
        body: { error: rate.error, message: rate.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    const runState = (await storage.get(`run:${runId}`)) ?? {
      create_issue: false,
      assign_copilot: false,
      created_issue_number: null,
    };
    const bounds = checkRunBounds(runState, operation);
    if (!bounds.ok) {
      return this._json({
        status: bounds.status,
        body: { error: bounds.error, message: bounds.message },
        githubCalled: false,
        githubStatus: null,
        idempotencyState: null,
      });
    }

    if (operation === 'assign_copilot') {
      const belong = assertAssignIssueBelongsToRun(runState, operationData?.issueNumber);
      if (!belong.ok) {
        return this._json({
          status: belong.status,
          body: { error: belong.error, message: belong.message },
          githubCalled: false,
          githubStatus: null,
          idempotencyState: null,
        });
      }
    }

    const pending = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      operation,
      run_id: runId,
      gate,
      state: IDEM_STATES.PENDING,
      safe_result: null,
    };
    await storage.put(`idem:${idempotencyKey}`, pending);

    const githubCall = buildGithubCall(operation, operationData, github);
    let result;
    try {
      result = await githubCall();
    } catch {
      const safe = {
        error: 'BLOCKED_RECONCILIATION_REQUIRED',
        message: 'GitHub call timed out or returned indeterminate result; auto-retry forbidden',
      };
      await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
      return this._json({
        status: 409,
        body: safe,
        githubCalled: true,
        githubStatus: null,
        idempotencyState: IDEM_STATES.UNKNOWN,
        unknown: true,
      });
    }

    if (result.ok) {
      const succeededRecord = markSucceeded(pending, result.safeResult);
      const batchEntries = [
        [`idem:${idempotencyKey}`, succeededRecord],
        ['rate:timestamps', rate.nextTimestamps],
      ];
      if (operation === 'create_issue') {
        batchEntries.push([`run:${runId}`, {
          ...runState,
          create_issue: true,
          created_issue_number: result.safeResult?.issue_number ?? result.safeResult?.number ?? null,
        }]);
      } else if (operation === 'assign_copilot') {
        batchEntries.push([`run:${runId}`, { ...runState, assign_copilot: true }]);
      }
      await storage.put(Object.fromEntries(batchEntries));
      return this._json({
        status: 200,
        body: result.safeResult,
        githubCalled: true,
        githubStatus: result.githubStatus ?? result.status ?? null,
        idempotencyState: IDEM_STATES.SUCCEEDED,
      });
    }

    if (isDeterministicClientError(result.status)) {
      await storage.put(`idem:${idempotencyKey}`, markFailed(pending, result.safeResult));
      return this._json({
        status: result.status,
        body: result.safeResult,
        githubCalled: true,
        githubStatus: result.githubStatus ?? result.status ?? null,
        idempotencyState: IDEM_STATES.FAILED,
      });
    }

    const safe = {
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: `GitHub upstream error — indeterminate result (status ${result.status}); auto-retry forbidden`,
    };
    await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
    return this._json({
      status: 409,
      body: safe,
      githubCalled: true,
      githubStatus: result.githubStatus ?? result.status ?? null,
      idempotencyState: IDEM_STATES.UNKNOWN,
      unknown: true,
    });
  }

  _json(data) {
    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    });
  }
}

function buildGithubCall(operation, operationData, github) {
  if (operation === 'create_issue') {
    return async () => {
      const res = await github.createIssue({
        title: operationData?.title,
        body: operationData?.body,
        labels: operationData?.labels,
      });
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, githubStatus: res.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        githubStatus: res.status,
        safeResult: {
          issue_number: res.data.number,
          number: res.data.number,
          html_url: res.data.html_url,
          title: res.data.title,
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  if (operation === 'assign_copilot') {
    return async () => {
      const res = await github.assignCopilot(operationData?.issueNumber);
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, githubStatus: res.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        githubStatus: res.status,
        safeResult: {
          issue_number: operationData?.issueNumber,
          assigned: (res.data?.assignees || []).map((a) => a.login),
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  return async () => ({
    ok: false,
    status: 400,
    githubStatus: null,
    safeResult: { error: 'UNKNOWN_OPERATION', message: `Unknown operation: ${operation}` },
  });
}
