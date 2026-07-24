/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * All write operations are serialized through this single DO instance,
 * identified by idFromName('kubzik96/genesis-ai').
 *
 * Concurrency serialization: all incoming fetch() calls are queued through
 * a per-instance Promise chain (_withLock).  This guarantees that two
 * concurrent requests with DIFFERENT idempotency keys but the SAME run_id
 * cannot both pass rate/run checks and call GitHub at the same time.
 *
 * Crash-safe idempotency:
 *   • PENDING is written to DO storage BEFORE the GitHub call.
 *   • After GitHub success, SUCCEEDED + updated timestamps + updated run
 *     state are written as one atomic batch put (storage.put(Object)) so a
 *     crash cannot leave SUCCEEDED while run_id still allows a duplicate.
 *   • UNKNOWN is written after an indeterminate result; reconstruction finds
 *     it and blocks retry without another GitHub call.
 *
 * Missing storage (state.storage absent) → fail closed, 503/BLOCKED,
 * githubCalled = false.  GitHub is never called without authoritative storage.
 *
 * Storage key schema:
 *   idem:{idempotencyKey}  — idempotency record
 *   rate:timestamps        — array of write timestamp ms values (rolling hour)
 *   run:{runId}            — per-run_id state
 *
 * In CODE_ONLY stage this module is source for deployment later;
 * unit tests use MemoryBrokerStore instead of the real DO runtime.
 */
import { evaluateIdempotency, markFailed, markSucceeded, markUnknown, isDeterministicClientError } from './idempotency.js';
import { checkHourlyWriteLimit, checkRunBounds, assertAssignIssueBelongsToRun } from './rate-limit.js';
import { createGithubClient, mapGithubError } from './github-client.js';
import { FIXED_FULL_NAME, IDEM_STATES } from './constants.js';

export class BrokerDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Per-instance queue: ensures all writes (including GitHub call) run serially.
    this._queue = Promise.resolve();
  }

  /**
   * Serialize fn through the per-instance queue.
   * While one write is active (including awaiting GitHub), all subsequent
   * calls queue behind it — preventing concurrent rate/run check races.
   *
   * fn is used as both the success and rejection handler so that this._queue
   * never becomes a rejected Promise, ensuring subsequent writes always
   * execute regardless of whether the previous write succeeded or threw.
   */
  _withLock(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /* ── Request handler ──────────────────────────────────────────────────── */

  async fetch(request) {
    // Fail closed when DO storage is unavailable — never call GitHub blind.
    if (!this.state?.storage) {
      return this._json({
        status: 503,
        body: { error: 'BLOCKED', message: 'DO storage unavailable; write blocked' },
        githubCalled: false,
      });
    }

    const github = createGithubClient({ pat: this.env?.GITHUB_PAT, fetchImpl: this.env?._fetchImpl });
    if (!github) {
      return this._json({
        status: 503,
        body: { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT not available in Durable Object' },
        githubCalled: false,
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
      });
    }
    return this._withLock(() => this._processWrite(payload, github));
  }

  async _processWrite({ idempotencyKey, requestHash, operation, runId, gate, operationData }, github) {
    const storage = this.state.storage;

    // 1. Check existing key in authoritative DO storage.
    const existing = (await storage.get(`idem:${idempotencyKey}`)) ?? null;
    const decision = evaluateIdempotency(existing, requestHash);

    if (decision.action === 'CONFLICT' || decision.action === 'BLOCKED' || decision.action === 'IN_FLIGHT') {
      return this._json({
        status: decision.status,
        body: { error: decision.error, message: decision.message },
        githubCalled: false,
      });
    }
    if (decision.action === 'REPLAY') {
      return this._json({
        status: decision.state === IDEM_STATES.FAILED ? decision.result?.status || 400 : 200,
        body: decision.result,
        githubCalled: false,
        replay: true,
      });
    }

    // Rate limit check.
    const timestamps = (await storage.get('rate:timestamps')) ?? [];
    const rate = checkHourlyWriteLimit(timestamps);
    if (!rate.ok) {
      return this._json({
        status: rate.status,
        body: { error: rate.error, message: rate.message },
        githubCalled: false,
      });
    }

    // Run bounds check.
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
      });
    }

    // Assign-copilot: verify the issue was created by Broker in this run_id.
    if (operation === 'assign_copilot') {
      const belong = assertAssignIssueBelongsToRun(runState, operationData?.issueNumber);
      if (!belong.ok) {
        return this._json({
          status: belong.status,
          body: { error: belong.error, message: belong.message },
          githubCalled: false,
        });
      }
    }

    // 2. Reserve PENDING in DO storage BEFORE calling GitHub.
    //    After any crash/reconstruction the stored PENDING blocks a duplicate call.
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

    // 3. Call GitHub.
    const githubCall = buildGithubCall(operation, operationData, github);
    let result;
    try {
      result = await githubCall();
    } catch {
      const safe = {
        error: 'BLOCKED_RECONCILIATION_REQUIRED',
        message: 'GitHub call timed out or returned indeterminate result; auto-retry forbidden',
      };
      // 4a. Persist UNKNOWN so reconstruction blocks retry without another GitHub call.
      await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
      return this._json({ status: 409, body: safe, githubCalled: true, unknown: true });
    }

    if (result.ok) {
      // 4b. Atomically persist SUCCEEDED + updated timestamps + updated run state
      //     as a single batch write.  A crash cannot leave SUCCEEDED while run_id
      //     state still allows a duplicate create or assign.
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
      return this._json({ status: 200, body: result.safeResult, githubCalled: true });
    }

    if (isDeterministicClientError(result.status)) {
      // 4c. Persist FAILED (deterministic client error — safe to replay).
      await storage.put(`idem:${idempotencyKey}`, markFailed(pending, result.safeResult));
      return this._json({ status: result.status, body: result.safeResult, githubCalled: true });
    }

    // 4d. Non-deterministic error (5xx, network) → UNKNOWN.
    const safe = {
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: `GitHub upstream error — indeterminate result (status ${result.status}); auto-retry forbidden`,
    };
    await storage.put(`idem:${idempotencyKey}`, markUnknown(pending, safe));
    return this._json({ status: 409, body: safe, githubCalled: true, unknown: true });
  }

  _json(data) {
    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * Build a githubCall closure for the given operation and data.
 * Called inside the Durable Object so the GitHub PAT never leaves the DO.
 */
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
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
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
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
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
    safeResult: { error: 'UNKNOWN_OPERATION', message: `Unknown operation: ${operation}` },
  });
}

