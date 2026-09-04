import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildXaiReviewRequest,
  createProductionXaiReviewClient,
  createXaiReviewClient,
  XaiReviewAdapterError,
} from '../src/xai-review-client.js';
import {
  GROK_REVIEWER_CONFIG,
  XAI_REVIEW_ENDPOINT,
  XAI_REVIEW_REQUEST_BYTE_LIMIT,
  XAI_REVIEW_RESPONSE_BYTE_LIMIT,
  XAI_REVIEW_TIMEOUT_MS,
} from '../src/xai-review-contract.js';

const input = (context = 'safe context') => ({
  repository: 'kubzik96/genesis-ai', prNumber: 81, expectedHeadSha: 'a'.repeat(40), diff: '+safe',
  changedFiles: [{ path: 'a.js' }], context, criteria: ['review'], producer: 'CODEX',
});
const validOutput = { verdict: 'APPROVE', reviewed_head_sha: 'a'.repeat(40), head_confirmed: 'YES', scope: 'CLEAN', findings: [], ready_gate_safe: 'YES' };
const envelopeText = (output = validOutput) => JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] });
const textResponse = (text) => ({ ok: true, text: async () => text });

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
    assert.equal(GROK_REVIEWER_CONFIG.timeout_ms, XAI_REVIEW_TIMEOUT_MS);
    assert.equal(GROK_REVIEWER_CONFIG.response_byte_limit, XAI_REVIEW_RESPONSE_BYTE_LIMIT);
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

  it('has no static or runtime GitHub mutation surface', async () => {
    const source = await readFile(new URL('../src/xai-review-client.js', import.meta.url), 'utf8');
    assert.equal(source.includes('github-client'), false);
    assert.equal(/createPullRequest|createIssue|mergePull|updateRef|deleteRef/.test(source), false);
    const client = createProductionXaiReviewClient();
    assert.deepEqual(Object.keys(client), ['review']);
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

  it('keeps production default-OFF and blocks before any network access', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; throw new Error('must not run'); };
    for (const productionEnabled of [undefined, false, 'true', 1]) {
      const client = createProductionXaiReviewClient({ productionEnabled, xaiApiKey: 'configured-but-unused', fetchImpl });
      await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_PRODUCTION_OFF' && error.called === false);
    }
    assert.equal(calls, 0);
  });

  it('issues exactly one reviewer-only chat-completions request with no retry, tools, or streaming', async () => {
    let calls = 0;
    const client = createProductionXaiReviewClient({
      productionEnabled: true,
      xaiApiKey: 'local-mock-key',
      fetchImpl: async (url, init) => {
        calls += 1;
        assert.equal(url, XAI_REVIEW_ENDPOINT);
        assert.equal(init.method, 'POST');
        assert.equal(init.headers.authorization, 'Bearer local-mock-key');
        assert.ok(init.signal instanceof AbortSignal);
        const body = JSON.parse(init.body);
        assert.equal(body.model, 'grok-4.3');
        assert.equal(body.stream, false);
        assert.equal('tools' in body, false);
        return textResponse(envelopeText());
      },
    });
    assert.deepEqual(await client.review(input()), validOutput);
    await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_REQUEST_LIMIT');
    assert.equal(calls, 1);
    assert.equal('apiKey' in client, false);
    assert.equal('fetch' in client, false);
  });

  it('fails a stalled production request closed after the bounded timeout', async () => {
    let calls = 0;
    const client = createProductionXaiReviewClient({
      productionEnabled: true,
      xaiApiKey: 'local-mock-key',
      timeoutMs: 5,
      fetchImpl: async (_url, init) => {
        calls += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      },
    });
    await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_API_FAILED' && error.called === true);
    assert.equal(calls, 1);
  });

  it('accepts an exact response byte limit and rejects one byte over without retry', async () => {
    const exact = envelopeText();
    const exactBytes = new TextEncoder().encode(exact).byteLength;
    let exactCalls = 0;
    const exactClient = createProductionXaiReviewClient({
      productionEnabled: true,
      xaiApiKey: 'local-mock-key',
      responseByteLimit: exactBytes,
      fetchImpl: async () => { exactCalls += 1; return textResponse(exact); },
    });
    assert.deepEqual(await exactClient.review(input()), validOutput);
    assert.equal(exactCalls, 1);

    let overCalls = 0;
    const overClient = createProductionXaiReviewClient({
      productionEnabled: true,
      xaiApiKey: 'local-mock-key',
      responseByteLimit: exactBytes - 1,
      fetchImpl: async () => { overCalls += 1; return textResponse(exact); },
    });
    await assert.rejects(() => overClient.review(input()), (error) => error.code === 'REVIEW_API_FAILED' && error.called === true);
    assert.equal(overCalls, 1);
  });

  it('fails malformed production envelopes and non-schema content closed without retry', async () => {
    for (const envelope of [
      {},
      { choices: [{ message: { content: '{not-json' } }] },
    ]) {
      let calls = 0;
      const client = createProductionXaiReviewClient({
        productionEnabled: true,
        xaiApiKey: 'local-mock-key',
        fetchImpl: async () => { calls += 1; return textResponse(JSON.stringify(envelope)); },
      });
      await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_API_FAILED' && error.called === true);
      assert.equal(calls, 1);
    }
  });

  it('rejects missing or invalid production prerequisites without attempting a request', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; };
    for (const options of [
      { productionEnabled: true, fetchImpl },
      { productionEnabled: true, xaiApiKey: 'local-mock-key', fetchImpl, timeoutMs: 0 },
      { productionEnabled: true, xaiApiKey: 'local-mock-key', fetchImpl, responseByteLimit: 0 },
    ]) {
      const client = createProductionXaiReviewClient(options);
      await assert.rejects(() => client.review(input()), (error) => error.code === 'REVIEW_PRODUCTION_UNAVAILABLE');
    }
    assert.equal(calls, 0);
  });
});
