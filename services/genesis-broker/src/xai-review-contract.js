export const XAI_REVIEW_MODEL = 'grok-4.3';
export const XAI_REVIEW_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
export const XAI_REVIEW_OUTPUT_TOKEN_LIMIT = 4096;
export const XAI_REVIEW_DIFF_BYTE_LIMIT = 64 * 1024;
export const XAI_REVIEW_CONTEXT_BYTE_LIMIT = 32 * 1024;
export const XAI_REVIEW_REQUEST_BYTE_LIMIT = 128 * 1024;

const finding = {
  type: 'object',
  additionalProperties: false,
  required: ['severity', 'disposition', 'evidence'],
  properties: {
    severity: { type: 'string', enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    disposition: { type: 'string', enum: ['NON_BLOCKING', 'BLOCKING'] },
    evidence: { type: 'string', minLength: 1, maxLength: 2000 },
  },
};

export const XAI_REVIEW_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'reviewed_head_sha', 'head_confirmed', 'scope', 'findings', 'ready_gate_safe'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'APPROVE_WITH_FINDINGS', 'REQUEST_CHANGES', 'BLOCKED'] },
    reviewed_head_sha: { type: 'string', pattern: '^[a-fA-F0-9]{40}$' },
    head_confirmed: { type: 'string', enum: ['YES', 'NO'] },
    scope: { type: 'string', enum: ['CLEAN', 'NOT_CLEAN'] },
    findings: { type: 'array', maxItems: 100, items: finding },
    ready_gate_safe: { type: 'string', enum: ['YES', 'NO'] },
  },
});

export const GROK_REVIEWER_CONFIG = Object.freeze({
  repository: 'kubzik96/genesis-ai',
  model: XAI_REVIEW_MODEL,
  endpoint: XAI_REVIEW_ENDPOINT,
  output_token_limit: XAI_REVIEW_OUTPUT_TOKEN_LIMIT,
  diff_byte_limit: XAI_REVIEW_DIFF_BYTE_LIMIT,
  context_byte_limit: XAI_REVIEW_CONTEXT_BYTE_LIMIT,
  request_byte_limit: XAI_REVIEW_REQUEST_BYTE_LIMIT,
  requests_per_operation: 1,
  automatic_retry: 0,
  streaming: false,
  tools: false,
  github_write_capabilities: Object.freeze([]),
});
