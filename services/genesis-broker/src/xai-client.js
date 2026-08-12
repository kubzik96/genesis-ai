import {
  XAI_ENDPOINT,
  XAI_MODEL,
  XAI_OUTPUT_TOKEN_LIMIT,
  XAI_REASONING_EFFORT,
  XAI_REQUEST_BYTE_LIMIT,
  XAI_RESPONSE_SCHEMA,
  XAI_SOURCE_BYTE_LIMIT,
  XAI_SOURCE_LINE_LIMIT,
  XAI_TIMEOUT_MS,
} from './xai-contract.js';
import { containsCredentialLikeValue } from './secret-scan.js';

const SYSTEM_PROMPT = [
  'Return exactly one bounded UTF-8 text edit for the supplied allowed file.',
  'Do not use tools, external data, credentials, or additional files.',
  'The response must conform to the supplied closed JSON schema.',
].join(' ');

export class XaiAdapterError extends Error {
  constructor(code, message, { called = false, costTicks = null } = {}) {
    super(message);
    this.name = 'XaiAdapterError';
    this.code = code;
    this.called = called;
    this.costTicks = costTicks;
  }
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function lineCount(value) {
  if (value === '') return 0;
  let lines = 1;
  for (let i = 0; i < value.length; i += 1) if (value.charCodeAt(i) === 10) lines += 1;
  return lines;
}

function validateInput(input) {
  const context = input?.context;
  if (!Array.isArray(context) || context.length !== 1 || typeof context[0]?.content !== 'string') {
    throw new XaiAdapterError('XAI_CONTEXT_INVALID', 'Exactly one text context is required');
  }
  if (utf8Bytes(context[0].content) > XAI_SOURCE_BYTE_LIMIT) {
    throw new XaiAdapterError('XAI_SOURCE_TOO_LARGE', 'Source exceeds live byte ceiling');
  }
  if (lineCount(context[0].content) > XAI_SOURCE_LINE_LIMIT) {
    throw new XaiAdapterError('XAI_SOURCE_TOO_MANY_LINES', 'Source exceeds live line ceiling');
  }
  if (containsCredentialLikeValue(JSON.stringify(input))) {
    throw new XaiAdapterError('XAI_SECRET_INPUT_REJECTED', 'Credential-like input is forbidden at the xAI boundary');
  }
}

export function buildXaiRequest(input) {
  validateInput(input);
  const body = {
    model: XAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'genesis_grok_draft_pr_change',
        strict: true,
        schema: XAI_RESPONSE_SCHEMA,
      },
    },
    reasoning_effort: XAI_REASONING_EFFORT,
    max_tokens: XAI_OUTPUT_TOKEN_LIMIT,
    stream: false,
  };
  const serialized = JSON.stringify(body);
  if (utf8Bytes(serialized) > XAI_REQUEST_BYTE_LIMIT) {
    throw new XaiAdapterError('XAI_REQUEST_TOO_LARGE', 'Serialized xAI request exceeds byte ceiling');
  }
  return { body, serialized };
}

function parseOutput(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function createXaiClient({ apiKey, fetchImpl = fetch, timeoutMs = XAI_TIMEOUT_MS } = {}) {
  if (!apiKey || typeof fetchImpl !== 'function') return null;
  return {
    __productionAdapter: true,
    async generateDraftPrChange(input) {
      const { serialized } = buildXaiRequest(input);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let responseText;
      try {
        response = await fetchImpl(XAI_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: serialized,
          signal: controller.signal,
        });
        responseText = await response.text();
      } catch {
        throw new XaiAdapterError('XAI_CALL_FAILED', 'xAI request failed or timed out', { called: true });
      } finally {
        clearTimeout(timeout);
      }

      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new XaiAdapterError('XAI_RESPONSE_INVALID', 'xAI response was not valid JSON', { called: true });
      }
      const costTicks = data?.usage?.cost_in_usd_ticks;
      if (!response.ok) {
        throw new XaiAdapterError('XAI_UPSTREAM_ERROR', `xAI returned HTTP ${response.status}`, {
          called: true,
          costTicks,
        });
      }
      const output = parseOutput(data);
      if (containsCredentialLikeValue(JSON.stringify(output))) {
        throw new XaiAdapterError('XAI_SECRET_OUTPUT_REJECTED', 'Credential-like output is forbidden at the GitHub boundary', {
          called: true,
          costTicks,
        });
      }
      return {
        __xaiProductionResult: true,
        output,
        costTicks,
      };
    },
  };
}
