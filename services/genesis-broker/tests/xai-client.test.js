import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildXaiRequest, createXaiClient, XaiAdapterError } from '../src/xai-client.js';
import {
  GROK_EXECUTOR_CONFIG_SHA256,
  GROK_EXECUTOR_REVIEWED_CONFIG,
  XAI_ENDPOINT,
  XAI_MODEL,
  XAI_OUTPUT_TOKEN_LIMIT,
  XAI_REASONING_EFFORT,
  XAI_REQUEST_BYTE_LIMIT,
  XAI_RESPONSE_SCHEMA,
  XAI_RESPONSE_SCHEMA_SHA256,
  XAI_SOURCE_BYTE_LIMIT,
} from '../src/xai-contract.js';

const BLOB_SHA = 'b'.repeat(40);

function operationInput(content = 'line1\nline2\nline3\n') {
  return {
    operation: 'create_branch_commit_draft_pr',
    run_id: 'run-1',
    gate: 'G2',
    confirmed_at: '2026-08-12T12:00:00.000Z',
    base_sha: 'a'.repeat(40),
    task: { title: 'Update memory', instruction: 'Change one line', allowed_files: ['MEMORY.md'] },
    context: [{ path: 'MEMORY.md', sha: BLOB_SHA, content }],
  };
}

function responseBody(costTicks = 500_000_000) {
  return {
    choices: [{ message: { content: JSON.stringify({
      summary: 'update',
      changes: [{ path: 'MEMORY.md', expected_blob_sha: BLOB_SHA, new_content: 'line1\nchanged\nline3\n' }],
      self_check: { scope_ok: true },
    }) } }],
    usage: { input_tokens: 100, output_tokens: 20, cost_in_usd_ticks: costTicks },
  };
}

describe('xAI production client', () => {
  it('keeps reviewed schema and config hashes pinned to their exact contracts', () => {
    const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    assert.equal(digest(XAI_RESPONSE_SCHEMA), XAI_RESPONSE_SCHEMA_SHA256);
    assert.equal(digest(GROK_EXECUTOR_REVIEWED_CONFIG), GROK_EXECUTOR_CONFIG_SHA256);
  });

  it('builds the exact one-call closed-schema contract without tools or streaming', async () => {
    const calls = [];
    const client = createXaiClient({
      apiKey: 'secret-test-key',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(responseBody()), { status: 200 });
      },
    });
    const result = await client.generateDraftPrChange(operationInput());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, XAI_ENDPOINT);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-test-key');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, XAI_MODEL);
    assert.equal(body.reasoning_effort, XAI_REASONING_EFFORT);
    assert.equal(body.max_tokens, XAI_OUTPUT_TOKEN_LIMIT);
    assert.equal(body.stream, false);
    assert.equal('tools' in body, false);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(
      body.response_format.json_schema.schema.properties.changes.items.properties.expected_blob_sha.pattern,
      '^[a-fA-F0-9]{40}$',
    );
    assert.equal(result.__xaiProductionResult, true);
    assert.equal(result.costTicks, 500_000_000);
    assert.equal(result.output.changes[0].path, 'MEMORY.md');
  });

  it('enforces source and total request byte ceilings before network', () => {
    assert.throws(
      () => buildXaiRequest(operationInput('x'.repeat(XAI_SOURCE_BYTE_LIMIT + 1))),
      (error) => error instanceof XaiAdapterError && error.code === 'XAI_SOURCE_TOO_LARGE' && error.called === false,
    );
    const instruction = 'x'.repeat(XAI_REQUEST_BYTE_LIMIT);
    const input = operationInput();
    input.task.instruction = instruction;
    assert.throws(
      () => buildXaiRequest(input),
      (error) => error instanceof XaiAdapterError && error.code === 'XAI_REQUEST_TOO_LARGE' && error.called === false,
    );
  });

  it('does not retry an upstream failure and never includes the key in the error', async () => {
    let calls = 0;
    const client = createXaiClient({
      apiKey: 'do-not-leak',
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { message: 'provider detail' } }), { status: 503 });
      },
    });
    await assert.rejects(
      () => client.generateDraftPrChange(operationInput()),
      (error) => error instanceof XaiAdapterError && error.code === 'XAI_UPSTREAM_ERROR' && !error.message.includes('do-not-leak'),
    );
    assert.equal(calls, 1);
  });

  it('keeps the timeout active through response-body consumption', async () => {
    let signal;
    const client = createXaiClient({
      apiKey: 'secret-test-key',
      timeoutMs: 10,
      fetchImpl: async (_url, init) => {
        signal = init.signal;
        return {
          ok: true,
          status: 200,
          async text() {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, 100);
              signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('aborted'));
              }, { once: true });
            });
            return JSON.stringify(responseBody());
          },
        };
      },
    });
    await assert.rejects(
      () => client.generateDraftPrChange(operationInput()),
      (error) => error instanceof XaiAdapterError && error.code === 'XAI_CALL_FAILED' && error.called === true,
    );
    assert.equal(signal.aborted, true);
  });

  it('rejects credential-like input before the network', async () => {
    let calls = 0;
    const client = createXaiClient({
      apiKey: 'secret-test-key',
      fetchImpl: async () => { calls += 1; return new Response('{}', { status: 200 }); },
    });
    const input = operationInput();
    input.task.instruction = `Use token github_pat_${'A'.repeat(32)}`;
    await assert.rejects(
      () => client.generateDraftPrChange(input),
      (error) => error instanceof XaiAdapterError && error.code === 'XAI_SECRET_INPUT_REJECTED' && error.called === false,
    );
    assert.equal(calls, 0);
  });

  it('rejects credential-like model output before the GitHub boundary while retaining cost', async () => {
    const body = responseBody();
    const parsed = JSON.parse(body.choices[0].message.content);
    parsed.changes[0].new_content = `token=sk-${'B'.repeat(32)}`;
    body.choices[0].message.content = JSON.stringify(parsed);
    const client = createXaiClient({
      apiKey: 'secret-test-key',
      fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
    });
    await assert.rejects(
      () => client.generateDraftPrChange(operationInput()),
      (error) => error instanceof XaiAdapterError
        && error.code === 'XAI_SECRET_OUTPUT_REJECTED'
        && error.called === true
        && error.costTicks === 500_000_000,
    );
  });
});
