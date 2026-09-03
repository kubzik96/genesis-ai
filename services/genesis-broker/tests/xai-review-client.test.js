import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildXaiReviewRequest, createXaiReviewClient, XaiReviewAdapterError } from '../src/xai-review-client.js';
import { GROK_REVIEWER_CONFIG, XAI_REVIEW_REQUEST_BYTE_LIMIT } from '../src/xai-review-contract.js';

const input = (context = 'safe context') => ({
  repository: 'kubzik96/genesis-ai', prNumber: 81, expectedHeadSha: 'a'.repeat(40), diff: '+safe',
  changedFiles: [{ path: 'a.js' }], context, criteria: ['review'], producer: 'CODEX',
});
const validOutput = { verdict: 'APPROVE', reviewed_head_sha: 'a'.repeat(40), head_confirmed: 'YES', scope: 'CLEAN', findings: [], ready_gate_safe: 'YES' };

describe('reviewer-only xAI local/mock adapter', () => {
  it('builds a closed one-request schema with tools and streaming off', () => {
    const { body } = buildXaiReviewRequest(input());
    assert.equal(body.stream, false);
    assert.equal('tools' in body, false);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(body.response_format.json_schema.schema.properties.findings.items.additionalProperties, false);
    assert.equal(GROK_REVIEWER_CONFIG.requests_per_operation, 1);
    assert.equal(GROK_REVIEWER_CONFIG.automatic_retry, 0);
    assert.deepEqual([...GROK_REVIEWER_CONFIG.github_write_capabilities], []);
  });

  it('uses exactly one injected mock invocation and provides no production/credential surface', async () => {
    let calls = 0;
    const client = createXaiReviewClient({ invoke: async () => { calls += 1; return validOutput; } });
    assert.equal(await client.review(input()), validOutput);
    await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_REQUEST_LIMIT');
    assert.equal(calls, 1);
    assert.equal('apiKey' in client, false);
    assert.equal('fetch' in client, false);
  });

  it('rejects credential-like input and output at the adapter boundary', async () => {
    assert.throws(() => buildXaiReviewRequest(input(`api_key=${'a'.repeat(25)}`)), (error) => error.code === 'REVIEW_SECRET_INPUT_REJECTED');
    const client = createXaiReviewClient({ invoke: async () => ({ ...validOutput, leak: `xai-${'a'.repeat(25)}` }) });
    await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_SECRET_OUTPUT_REJECTED');
  });

  it('enforces total request bounds before invocation', () => {
    assert.throws(() => buildXaiReviewRequest(input('x'.repeat(XAI_REVIEW_REQUEST_BYTE_LIMIT))), (error) => error.code === 'REVIEW_REQUEST_TOO_LARGE');
  });

  it('normalizes mock/API failure without retry or provider detail', async () => {
    let calls = 0;
    const client = createXaiReviewClient({ invoke: async () => { calls += 1; throw new Error('sensitive provider detail'); } });
    await assert.rejects(() => client.review(input()), (error) => error instanceof XaiReviewAdapterError && error.code === 'REVIEW_API_FAILED' && !error.message.includes('sensitive'));
    assert.equal(calls, 1);
  });
});
