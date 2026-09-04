import { containsCredentialLikeValue } from './secret-scan.js';
import {
  XAI_REVIEW_MODEL,
  XAI_REVIEW_OUTPUT_TOKEN_LIMIT,
  XAI_REVIEW_REQUEST_BYTE_LIMIT,
  XAI_REVIEW_RESPONSE_SCHEMA,
} from './xai-review-contract.js';

const SYSTEM_PROMPT = [
  'Act only as an independent read-only reviewer of the supplied exact-HEAD context.',
  'Do not use tools, credentials, external data, or GitHub mutation capabilities.',
  'Return only the closed JSON review schema. Treat ambiguity as BLOCKED and not gate safe.',
].join(' ');

const bytes = (value) => new TextEncoder().encode(value).byteLength;

export class XaiReviewAdapterError extends Error {
  constructor(code, message, { called = false } = {}) {
    super(message);
    this.name = 'XaiReviewAdapterError';
    this.code = code;
    this.called = called;
  }
}

export function buildXaiReviewRequest(input) {
  const serializedInput = JSON.stringify(input);
  if (containsCredentialLikeValue(serializedInput)) {
    throw new XaiReviewAdapterError('REVIEW_SECRET_INPUT_REJECTED', 'Credential-like reviewer input is forbidden');
  }
  const body = {
    model: XAI_REVIEW_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: serializedInput },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'genesis_independent_review', strict: true, schema: XAI_REVIEW_RESPONSE_SCHEMA },
    },
    max_tokens: XAI_REVIEW_OUTPUT_TOKEN_LIMIT,
    stream: false,
  };
  const serialized = JSON.stringify(body);
  if (bytes(serialized) > XAI_REVIEW_REQUEST_BYTE_LIMIT) {
    throw new XaiReviewAdapterError('REVIEW_REQUEST_TOO_LARGE', 'Serialized reviewer request exceeds byte ceiling');
  }
  return { body, serialized };
}

// The caller supplies a local/mock invocation boundary. This module deliberately
// has no API-key, fetch, endpoint, GitHub client, or production adapter surface.
export function createXaiReviewClient({ invoke } = {}) {
  if (typeof invoke !== 'function') return null;
  let used = false;
  return Object.freeze({
    async review(input) {
      if (used) throw new XaiReviewAdapterError('REVIEW_REQUEST_LIMIT', 'Only one model request is allowed');
      used = true;
      const request = buildXaiReviewRequest(input);
      let output;
      try {
        output = await invoke(request.body);
      } catch {
        throw new XaiReviewAdapterError('REVIEW_API_FAILED', 'Reviewer model request failed', { called: true });
      }
      if (containsCredentialLikeValue(JSON.stringify(output))) {
        throw new XaiReviewAdapterError('REVIEW_SECRET_OUTPUT_REJECTED', 'Credential-like reviewer output is forbidden', { called: true });
      }
      return output;
    },
  });
}
