import { MAX_WRITES_PER_HOUR } from './constants.js';

/**
 * In-memory style rate limit model for tests and DO storage records.
 * Production enforces via Durable Object (single instance per repo).
 */
export function checkHourlyWriteLimit(writeTimestamps, now = Date.now()) {
  const windowStart = now - 60 * 60 * 1000;
  const recent = (writeTimestamps || []).filter((t) => t >= windowStart);
  if (recent.length >= MAX_WRITES_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      error: 'RATE_LIMITED',
      message: `Max ${MAX_WRITES_PER_HOUR} writes per hour exceeded`,
      recentCount: recent.length,
    };
  }
  return { ok: true, recentCount: recent.length, nextTimestamps: [...recent, now] };
}

/**
 * Per-run_id bounds: at most one successful create_issue and one successful assign_copilot.
 */
export function checkRunBounds(runState, operation) {
  const state = runState || { create_issue: false, assign_copilot: false, created_issue_number: null };
  if (operation === 'create_issue' && state.create_issue) {
    return {
      ok: false,
      status: 429,
      error: 'RATE_LIMITED',
      message: 'Only one successful POST /v1/issues per run_id',
    };
  }
  if (operation === 'assign_copilot' && state.assign_copilot) {
    return {
      ok: false,
      status: 429,
      error: 'RATE_LIMITED',
      message: 'Only one successful assign-copilot per run_id',
    };
  }
  return { ok: true, state };
}

export function assertAssignIssueBelongsToRun(runState, issueNumber) {
  if (!runState || runState.created_issue_number == null) {
    return {
      ok: false,
      status: 403,
      error: 'ISSUE_NOT_FROM_RUN',
      message: 'assign-copilot allowed only for Issue created by Broker in this run_id',
    };
  }
  if (Number(runState.created_issue_number) !== Number(issueNumber)) {
    return {
      ok: false,
      status: 403,
      error: 'ISSUE_NOT_FROM_RUN',
      message: 'Issue number does not match Broker-created Issue for this run_id',
    };
  }
  return { ok: true };
}
