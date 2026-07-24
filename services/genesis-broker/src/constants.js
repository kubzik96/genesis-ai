/** Fixed repository and branch — clients cannot override (S-0002 §4.3). */
export const FIXED_OWNER = 'kubzik96';
export const FIXED_REPO = 'genesis-ai';
export const FIXED_FULL_NAME = `${FIXED_OWNER}/${FIXED_REPO}`;
export const FIXED_BASE_BRANCH = 'main';
export const GITHUB_API_HOST = 'api.github.com';

/** Copilot coding agent bot login for Issue Assignment API (Path B2). */
export const COPILOT_BOT = 'copilot-swe-agent[bot]';

/** Gate TTL window (minutes). */
export const GATE_TTL_MINUTES = 10;

/** Max write operations per service token per rolling hour. */
export const MAX_WRITES_PER_HOUR = 10;

/** Allowed context paths for POST /v1/context/read. */
export const CONTEXT_ALLOWLIST = Object.freeze([
  'bridge/QUEUE.md',
  'bridge/HANDOFF.md',
  'governance/Constitution.md',
  'governance/DevelopmentWorkflow.md',
  'specifications/INDEX.md',
  'specifications/S-0001-Genesis-One-Window-Execution-Spike.md',
  'specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md',
]);

export const GATES = Object.freeze({
  CREATE_ISSUE: 'G1',
  ASSIGN_COPILOT: 'G2',
});

export const IDEM_STATES = Object.freeze({
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
});
