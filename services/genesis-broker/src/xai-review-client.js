import { containsCredentialLikeValue } from './secret-scan.js';
import {
  XAI_REVIEW_MODEL,
  XAI_REVIEW_ENDPOINT,
  XAI_REVIEW_OUTPUT_TOKEN_LIMIT,
  XAI_REVIEW_REQUEST_BYTE_LIMIT,
  XAI_REVIEW_RESPONSE_BYTE_LIMIT,
  XAI_REVIEW_RESPONSE_SCHEMA,
  XAI_REVIEW_TIMEOUT_MS,
} from './xai-review-contract.js';

const SYSTEM_PROMPT = [
  'Act only as an independent read-only reviewer of the supplied exact-HEAD context.',
  'Do not use tools, credentials, external data, or GitHub mutation capabilities.',
  'Return only the closed JSON review schema. Treat ambiguity as BLOCKED and not gate safe.',
].join(' ');

const bytes = (value) => new TextEncoder().encode(value).byteLength;
const MAX_TIMEOUT_MS = 2_147_483_647;

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

async function readBoundedResponseText(response, byteLimit) {
  if (typeof response?.text !== 'function') throw new Error('xAI response body is unavailable');
  const text = await response.text();
  if (bytes(text) > byteLimit) throw new Error('xAI response exceeds byte ceiling');
  return text;
}

// This is a reviewer-only transport. Its activation must be supplied as the
// literal boolean true by a later, separately authorized runtime gate. Merely
// configuring a key or a fetch implementation can never activate it.
export function createProductionXaiReviewClient({
  productionEnabled = false,
  xaiApiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = XAI_REVIEW_TIMEOUT_MS,
  responseByteLimit = XAI_REVIEW_RESPONSE_BYTE_LIMIT,
} = {}) {
  let used = false;
  return Object.freeze({
    async review(input) {
      if (productionEnabled !== true) {
        throw new XaiReviewAdapterError('REVIEW_PRODUCTION_OFF', 'Production reviewer transport is disabled');
      }
      if (typeof xaiApiKey !== 'string' || !xaiApiKey || typeof fetchImpl !== 'function') {
        throw new XaiReviewAdapterError('REVIEW_PRODUCTION_UNAVAILABLE', 'Production reviewer transport is unavailable');
      }
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS || !Number.isSafeInteger(responseByteLimit) || responseByteLimit <= 0) {
        throw new XaiReviewAdapterError('REVIEW_PRODUCTION_UNAVAILABLE', 'Production reviewer transport bounds are invalid');
      }
      if (used) throw new XaiReviewAdapterError('REVIEW_REQUEST_LIMIT', 'Only one model request is allowed');
      used = true;

      const client = createXaiReviewClient({
        invoke: async (body) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const response = await fetchImpl(XAI_REVIEW_ENDPOINT, {
              method: 'POST',
              headers: Object.freeze({
                authorization: `Bearer ${xaiApiKey}`,
                'content-type': 'application/json',
              }),
              body: JSON.stringify(body),
              signal: controller.signal,
            });
            if (!response?.ok) throw new Error('xAI request failed');
            const rawEnvelope = await readBoundedResponseText(response, responseByteLimit);
            const envelope = JSON.parse(rawEnvelope);
            const content = envelope?.choices?.[0]?.message?.content;
            if (typeof content !== 'string') throw new Error('xAI response is malformed');
            return JSON.parse(content);
          } finally {
            clearTimeout(timeout);
          }
        },
      });
      return client.review(input);
    },
  });
}
