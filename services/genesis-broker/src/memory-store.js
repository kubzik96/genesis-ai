/**
 * In-process Durable Object stand-in for unit tests.
 * Mirrors SQLite-backed DO semantics: serialize writes, store idempotency + rate/run state.
 */
import { evaluateIdempotency, markFailed, markSucceeded, markUnknown, isDeterministicClientError } from './idempotency.js';
import { checkHourlyWriteLimit, checkRunBounds, assertAssignIssueBelongsToRun } from './rate-limit.js';
import { IDEM_STATES } from './constants.js';

export class MemoryBrokerStore {
  constructor() {
    this.idem = new Map();
    this.writeTimestamps = [];
    this.runs = new Map();
    this.queue = Promise.resolve();
  }

  async withLock(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getIdem(key) {
    return this.idem.get(key) || null;
  }

  setIdem(key, record) {
    this.idem.set(key, record);
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }

  setRun(runId, state) {
    this.runs.set(runId, state);
  }

  async executeWrite({
    idempotencyKey,
    requestHash,
    operation,
    runId,
    gate,
    operationData,
    githubCall,
  }) {
    return this.withLock(async () => {
      const existing = this.getIdem(idempotencyKey);
      const decision = evaluateIdempotency(existing, requestHash);
      if (decision.action === 'CONFLICT' || decision.action === 'BLOCKED' || decision.action === 'IN_FLIGHT') {
        return {
          status: decision.status,
          body: { error: decision.error, message: decision.message },
          githubCalled: false,
        };
      }
      if (decision.action === 'REPLAY') {
        return {
          status: decision.state === IDEM_STATES.FAILED ? decision.result?.status || 400 : 200,
          body: decision.result,
          githubCalled: false,
          replay: true,
        };
      }

      const rate = checkHourlyWriteLimit(this.writeTimestamps);
      if (!rate.ok) {
        return {
          status: rate.status,
          body: { error: rate.error, message: rate.message },
          githubCalled: false,
        };
      }

      const runState = this.getRun(runId) || {
        create_issue: false,
        assign_copilot: false,
        created_issue_number: null,
      };
      const bounds = checkRunBounds(runState, operation);
      if (!bounds.ok) {
        return {
          status: bounds.status,
          body: { error: bounds.error, message: bounds.message },
          githubCalled: false,
        };
      }

      // For assign_copilot, verify the issue was created by Broker in this run_id (atomic check).
      if (operation === 'assign_copilot') {
        const belong = assertAssignIssueBelongsToRun(runState, operationData?.issueNumber);
        if (!belong.ok) {
          return {
            status: belong.status,
            body: { error: belong.error, message: belong.message },
            githubCalled: false,
          };
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
      this.setIdem(idempotencyKey, pending);

      let result;
      try {
        result = await githubCall();
      } catch {
        const safe = {
          error: 'BLOCKED_RECONCILIATION_REQUIRED',
          message: 'GitHub call timed out or returned indeterminate result; auto-retry forbidden',
        };
        this.setIdem(idempotencyKey, markUnknown(pending, safe));
        return { status: 409, body: safe, githubCalled: true, unknown: true };
      }

      if (result.ok) {
        this.writeTimestamps = rate.nextTimestamps;
        if (operation === 'create_issue') {
          this.setRun(runId, {
            ...runState,
            create_issue: true,
            created_issue_number: result.safeResult?.issue_number ?? result.safeResult?.number ?? null,
          });
        } else if (operation === 'assign_copilot') {
          this.setRun(runId, { ...runState, assign_copilot: true });
        }
        this.setIdem(idempotencyKey, markSucceeded(pending, result.safeResult));
        return { status: 200, body: result.safeResult, githubCalled: true };
      }

      if (isDeterministicClientError(result.status)) {
        this.setIdem(idempotencyKey, markFailed(pending, result.safeResult));
        return { status: result.status, body: result.safeResult, githubCalled: true };
      }

      // Non-deterministic error (5xx, network timeout via non-ok result): mark UNKNOWN.
      // Always use BLOCKED_RECONCILIATION_REQUIRED so the client knows not to auto-retry.
      const safe = {
        error: 'BLOCKED_RECONCILIATION_REQUIRED',
        message: `GitHub upstream error — indeterminate result (status ${result.status}); auto-retry forbidden`,
      };
      this.setIdem(idempotencyKey, markUnknown(pending, safe));
      return { status: 409, body: safe, githubCalled: true, unknown: true };
    });
  }
}
