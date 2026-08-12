import { GROK_DRAFT_PR_LIMITS } from './constants.js';

export const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
export const XAI_MODEL = 'grok-4.3';
export const XAI_REASONING_EFFORT = 'low';
export const XAI_OUTPUT_TOKEN_LIMIT = 8192;
export const XAI_TIMEOUT_MS = 45_000;
export const XAI_SOURCE_BYTE_LIMIT = 6 * 1024;
export const XAI_SOURCE_LINE_LIMIT = 4096;
export const XAI_REQUEST_BYTE_LIMIT = 32 * 1024;

export const XAI_BUDGET_TICKS_PER_USD = 10_000_000_000;
export const XAI_BUDGET_RESERVATION_TICKS = 1_000_000_000;
export const XAI_BUDGET_MONTHLY_LIMIT_TICKS = 50_000_000_000;

export const XAI_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'changes', 'self_check'],
  properties: {
    summary: { type: 'string', minLength: 1, maxLength: 500 },
    changes: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'expected_blob_sha', 'new_content'],
        properties: {
          path: { type: 'string', const: 'MEMORY.md' },
          expected_blob_sha: { type: 'string', pattern: '[a-fA-F0-9]{40}' },
          new_content: { type: 'string' },
        },
      },
    },
    self_check: {
      type: 'object',
      additionalProperties: false,
      required: ['scope_ok'],
      properties: {
        scope_ok: { type: 'boolean', const: true },
      },
    },
  },
});

export const XAI_RESPONSE_SCHEMA_SHA256 = '7d491c8bc6cced3742e1b04567cc158bbff8b771db4de44ae96e014f7c3758be';

export const GROK_EXECUTOR_REVIEWED_CONFIG = Object.freeze({
  endpoint: XAI_ENDPOINT,
  model: XAI_MODEL,
  reasoning_effort: XAI_REASONING_EFFORT,
  output_token_limit: XAI_OUTPUT_TOKEN_LIMIT,
  timeout_ms: XAI_TIMEOUT_MS,
  source_byte_limit: XAI_SOURCE_BYTE_LIMIT,
  source_line_limit: XAI_SOURCE_LINE_LIMIT,
  request_byte_limit: XAI_REQUEST_BYTE_LIMIT,
  requests_per_operation: 1,
  automatic_retry: 0,
  streaming: false,
  tools: false,
  monthly_limit_ticks: XAI_BUDGET_MONTHLY_LIMIT_TICKS,
  reservation_ticks: XAI_BUDGET_RESERVATION_TICKS,
  reconciliation_key: 'budget:xai:reconciliation',
  runtime_version_metadata_binding: 'CF_VERSION_METADATA',
  runtime_version_tag: 'exact reviewed Git commit SHA',
  branch_prefix: GROK_DRAFT_PR_LIMITS.BRANCH_PREFIX,
  max_files: GROK_DRAFT_PR_LIMITS.MAX_FILES,
  allowed_file: GROK_DRAFT_PR_LIMITS.ALLOWED_FILE,
  max_changed_lines: GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES,
  max_unified_diff_bytes: GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES,
});

export const GROK_EXECUTOR_CONFIG_SHA256 = '613ad98634fae6824e135bf0fa845d60ab62e87191887bfe908d6a3bc5bb30da';
