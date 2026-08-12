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
 * Per-run_id bounds: at most one successful operation per write contract.
 */
export function checkRunBounds(runState, operation) {
  const state = runState || {
    create_issue: false,
    assign_copilot: false,
    create_branch_commit_draft_pr: false,
    create_branch_commit_draft_pr_blocked: false,
    create_branch_commit_draft_pr_pending: null,
    created_issue_number: null,
  };
  if (operation === 'create_branch_commit_draft_pr' && state.create_branch_commit_draft_pr_pending) {
    return {
      ok: false,
      status: 409,
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: 'Prior draft-pr operation is still reserved; reconciliation required before retry',
    };
  }
  if (operation === 'create_branch_commit_draft_pr' && state.create_branch_commit_draft_pr_blocked) {
    return {
      ok: false,
      status: 409,
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: 'Prior post-branch draft-pr failure requires reconciliation; auto-retry forbidden',
    };
  }
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
  if (operation === 'create_branch_commit_draft_pr' && state.create_branch_commit_draft_pr) {
    return {
      ok: false,
      status: 429,
      error: 'RATE_LIMITED',
      message: 'Only one successful grok draft-pr operation per run_id',
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
