/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * All write operations are serialized through this single DO instance,
 * identified by idFromName('kubzik96/genesis-ai').
 *
 * Crash-safe idempotency: each state transition is persisted to DO storage
 * individually — PENDING is written BEFORE the GitHub call, so that DO
 * reconstruction after a crash finds the key and blocks a duplicate GitHub
 * call.  The final state (SUCCEEDED / FAILED / UNKNOWN) replaces PENDING
 * after the GitHub call returns (or throws).
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
  }

  /* ── Storage helpers ──────────────────────────────────────────────────── */

  async _getIdem(key) {
    if (!this.state?.storage) return null;
    return (await this.state.storage.get(`idem:${key}`)) ?? null;
  }

  async _putIdem(key, record) {
    if (!this.state?.storage) return;
    await this.state.storage.put(`idem:${key}`, record);
  }

  async _getTimestamps() {
    if (!this.state?.storage) return [];
    return (await this.state.storage.get('rate:timestamps')) ?? [];
  }

  async _putTimestamps(timestamps) {
    if (!this.state?.storage) return;
    await this.state.storage.put('rate:timestamps', timestamps);
  }

  async _getRun(runId) {
    if (!this.state?.storage) return null;
    return (await this.state.storage.get(`run:${runId}`)) ?? null;
  }

  async _putRun(runId, runState) {
    if (!this.state?.storage) return;
    await this.state.storage.put(`run:${runId}`, runState);
  }

  /* ── Request handler ──────────────────────────────────────────────────── */

  async fetch(request) {
    const { idempotencyKey, requestHash, operation, runId, gate, operationData } = await request.json();

    const github = createGithubClient({ pat: this.env?.GITHUB_PAT, fetchImpl: this.env?._fetchImpl });
    if (!github) {
      return this._json({
        status: 503,
        body: { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT not available in Durable Object' },
        githubCalled: false,
      });
    }

    // 1. Check existing key in authoritative DO storage.
    const existing = await this._getIdem(idempotencyKey);
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
    const timestamps = await this._getTimestamps();
    const rate = checkHourlyWriteLimit(timestamps);
    if (!rate.ok) {
      return this._json({
        status: rate.status,
        body: { error: rate.error, message: rate.message },
        githubCalled: false,
      });
    }

    // Run bounds check.
    const runState = (await this._getRun(runId)) ?? {
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

    // Assign-copilot: verify the issue was created by Broker in this run_id (atomic, before PENDING).
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

    // 2. Atomically reserve PENDING in DO storage BEFORE calling GitHub.
    //    After any crash/reconstruction the stored PENDING will block a duplicate call.
    const pending = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      operation,
      run_id: runId,
      gate,
      state: IDEM_STATES.PENDING,
      safe_result: null,
    };
    await this._putIdem(idempotencyKey, pending);

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
      await this._putIdem(idempotencyKey, markUnknown(pending, safe));
      return this._json({ status: 409, body: safe, githubCalled: true, unknown: true });
    }

    if (result.ok) {
      // 4b. Persist SUCCEEDED and update auxiliary state.
      await this._putIdem(idempotencyKey, markSucceeded(pending, result.safeResult));
      await this._putTimestamps(rate.nextTimestamps);
      if (operation === 'create_issue') {
        await this._putRun(runId, {
          ...runState,
          create_issue: true,
          created_issue_number: result.safeResult?.issue_number ?? result.safeResult?.number ?? null,
        });
      } else if (operation === 'assign_copilot') {
        await this._putRun(runId, { ...runState, assign_copilot: true });
      }
      return this._json({ status: 200, body: result.safeResult, githubCalled: true });
    }

    if (isDeterministicClientError(result.status)) {
      // 4c. Persist FAILED (deterministic client error — safe to replay).
      await this._putIdem(idempotencyKey, markFailed(pending, result.safeResult));
      return this._json({ status: result.status, body: result.safeResult, githubCalled: true });
    }

    // 4d. Non-deterministic error (5xx, network) → UNKNOWN.
    const safe = {
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: `GitHub upstream error — indeterminate result (status ${result.status}); auto-retry forbidden`,
    };
    await this._putIdem(idempotencyKey, markUnknown(pending, safe));
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

