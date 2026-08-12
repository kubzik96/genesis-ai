/** Shared constants for Genesis Broker. */

export const REPO_OWNER = 'kubzik96';
export const REPO_NAME = 'genesis-ai';
export const DEFAULT_BASE_BRANCH = 'main';

/** Operation identifiers. */
export const OP_CREATE_ISSUE = 'create_issue';
export const OP_ASSIGN_COPILOT = 'assign_copilot';
export const OP_GROK_DRAFT_PR = 'create_branch_commit_draft_pr';

/** Gate names. */
export const GATES = {
  ISSUE_CREATE: 'G1',
  ASSIGN_COPILOT: 'G2',
  GROK_DRAFT_PR: 'G_GROK_DRAFT_PR',
};

/** Grok hard limits (T-011 Stage 1). */
export const GROK_MAX_FILES = 1;
export const GROK_ALLOWED_FILE = 'MEMORY.md';
export const GROK_MAX_LINES = 3;
export const GROK_MAX_DIFF_BYTES = 2048; // 2 KiB
export const GROK_DRAFT_ONLY = true;

/** Rate / run bounds. */
export const RUN_BOUNDS = {
  [OP_CREATE_ISSUE]: { maxPerRun: 5 },
  [OP_ASSIGN_COPILOT]: { maxPerRun: 10 },
  [OP_GROK_DRAFT_PR]: { maxPerRun: 3 },
};

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
