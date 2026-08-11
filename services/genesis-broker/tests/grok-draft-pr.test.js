import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/router.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { IDEM_STATES } from '../src/constants.js';

const BASE_SHA = 'a'.repeat(40);
const BLOB_SHA = 'b'.repeat(40);

function makeRequest({ headers = {}, body }) {
  return new Request('https://broker.test/v1/executions/grok/draft-pr', {
    method: 'POST',
    headers: new Headers({
      authorization: ['Bearer', 'secret'].join(' '),
      'content-type': 'application/json',
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

function baseBody(overrides = {}) {
  return {
    operation: 'create_branch_commit_draft_pr',
    run_id: 'run-1',
    gate: 'G2',
    confirmed_at: new Date().toISOString(),
    base_sha: BASE_SHA,
    task: {
      title: 'Update memory',
      instruction: 'Change one line',
      allowed_files: ['MEMORY.md'],
    },
    ...overrides,
  };
}

function githubMock({
  beforeSha = BASE_SHA,
  afterSha = BASE_SHA,
  createRefStatus = 201,
  updateFileStatus = 200,
  pullStatus = 201,
  throwAt = null,
} = {}) {
  const calls = { getRef: 0, getContentAtRef: 0, createRef: 0, updateFile: 0, createPullRequest: 0 };
  return {
    calls,
    async getRef() {
      calls.getRef += 1;
      const sha = calls.getRef === 1 ? beforeSha : afterSha;
      return {
        ok: true,
        status: 200,
        data: { object: { sha } },
      };
    },
    async getContentAtRef() {
      calls.getContentAtRef += 1;
      return {
        ok: true,
        status: 200,
        data: { sha: BLOB_SHA, encoding: 'base64', content: btoa('line1\nline2\nline3\n') },
      };
    },
    async createRef() {
      calls.createRef += 1;
      if (throwAt === 'createRef') throw new Error('timeout');
      return createRefStatus >= 400
        ? { ok: false, status: createRefStatus, data: { message: 'exists' } }
        : { ok: true, status: createRefStatus, data: {} };
    },
    async updateFile() {
      calls.updateFile += 1;
      if (throwAt === 'updateFile') throw new Error('timeout');
      return updateFileStatus >= 400
        ? { ok: false, status: updateFileStatus, data: { message: 'fail' } }
        : { ok: true, status: updateFileStatus, data: { commit: { sha: 'c'.repeat(40) } } };
    },
    async createPullRequest() {
      calls.createPullRequest += 1;
      if (throwAt === 'createPullRequest') throw new Error('timeout');
      return pullStatus >= 400
        ? { ok: false, status: pullStatus, data: { message: 'fail' } }
        : { ok: true, status: pullStatus, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true } };
    },
  };
}

function xaiResponse(newContent = 'line1\nline-two\nline3\n') {
  return {
    summary: 'update',
    self_check: { scope_ok: true },
    changes: [{
      path: 'MEMORY.md',
      expected_blob_sha: BLOB_SHA,
      new_content: newContent,
    }],
  };
}

function envWith({ github, xai }) {
  return {
    BROKER_SERVICE_TOKEN: 'secret',
    GITHUB_PAT: 'pat',
    store: new MemoryBrokerStore(),
    github,
    xai: {
      calls: 0,
      async generateDraftPrChange(...args) {
        xai.calls += 1;
        return xai.fn(...args);
      },
    },
  };
}

describe('POST /v1/executions/grok/draft-pr', () => {
  it('happy path returns safe draft-pr result', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const res = await handleRequest(makeRequest({ headers: { 'idempotency-key': 'k1' }, body: baseBody() }), env);
    const body = JSON.parse(res.body);
    assert.equal(res.status, 200);
    assert.equal(body.status, 'DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW');
    assert.equal(body.branch, 'genesis/grok/run-1');
    assert.equal(body.pr_number, 123);
    assert.deepEqual(body.changed_files, ['MEMORY.md']);
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.createPullRequest, 1);
  });

  it('idempotency replay avoids second xAI/GitHub write', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const req = makeRequest({ headers: { 'idempotency-key': 'k-replay' }, body: baseBody() });
    const req2 = makeRequest({ headers: { 'idempotency-key': 'k-replay' }, body: baseBody() });
    const first = await handleRequest(req, env);
    const second = await handleRequest(req2, env);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.createPullRequest, 1);
  });

  it('rejects stale base sha before xAI', async () => {
    const github = githubMock({ beforeSha: 'c'.repeat(40) });
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-stale-1' }, body: baseBody() }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).error, 'BASE_SHA_MISMATCH');
    assert.equal(xai.calls, 0);
  });

  it('rejects stale base sha after xAI and before writes', async () => {
    const github = githubMock({ afterSha: 'd'.repeat(40) });
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-stale-2' }, body: baseBody() }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).error, 'BASE_SHA_MISMATCH');
    assert.equal(github.calls.createRef, 0);
  });

  it('rejects malformed xAI response and second file', async () => {
    const malformed = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-bad-xai' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => ({ ...xaiResponse(), unknown: true }) },
      }),
    );
    assert.equal(malformed.status, 422);
    assert.equal(JSON.parse(malformed.body).error, 'INVALID_XAI_RESPONSE');

    const secondFile = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-second-file' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: {
          calls: 0,
          fn: async () => ({ ...xaiResponse(), changes: [xaiResponse().changes[0], xaiResponse().changes[0]] }),
        },
      }),
    );
    assert.equal(secondFile.status, 422);
    assert.equal(JSON.parse(secondFile.body).error, 'MULTIPLE_FILES_REJECTED');
  });

  it('enforces changed lines and diff size hard limits', async () => {
    const tooManyLines = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-lines' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse('a\nb\nc\nd\ne\n') },
      }),
    );
    assert.equal(tooManyLines.status, 422);
    assert.equal(JSON.parse(tooManyLines.body).error, 'CHANGED_LINES_EXCEEDED');

    const hugeLine = 'x'.repeat(2100);
    const tooLargeDiff = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-diff' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse(`line1\n${hugeLine}\nline3\n`) },
      }),
    );
    assert.equal(tooLargeDiff.status, 422);
    assert.equal(JSON.parse(tooLargeDiff.body).error, 'DIFF_SIZE_EXCEEDED');
  });

  it('rejects binary content and existing branch', async () => {
    const binary = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-bin' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse('line1\n\u0000\nline3\n') },
      }),
    );
    assert.equal(binary.status, 422);
    assert.equal(JSON.parse(binary.body).error, 'BINARY_CONTENT_REJECTED');

    const branchExists = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-branch' }, body: baseBody() }),
      envWith({
        github: githubMock({ createRefStatus: 422 }),
        xai: { calls: 0, fn: async () => xaiResponse() },
      }),
    );
    assert.equal(branchExists.status, 422);
    assert.equal(JSON.parse(branchExists.body).error, 'GITHUB_422');
  });

  it('duplicate run_id write is rate-limited', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const first = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-run-1' }, body: baseBody({ run_id: 'run-dup' }) }),
      env,
    );
    const second = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-run-2' }, body: baseBody({ run_id: 'run-dup' }) }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(JSON.parse(second.body).error, 'RATE_LIMITED');
  });

  it('rejects expired gate, missing idempotency key, unauthorized path and auth failures', async () => {
    const expired = await handleRequest(
      makeRequest({
        headers: { 'idempotency-key': 'k-expired' },
        body: baseBody({ confirmed_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() }),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(expired.status, 403);
    assert.equal(JSON.parse(expired.body).error, 'GATE_EXPIRED');

    const missingIdem = await handleRequest(
      makeRequest({ body: baseBody() }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(missingIdem.status, 400);
    assert.equal(JSON.parse(missingIdem.body).error, 'MISSING_IDEMPOTENCY_KEY');

    const pathDenied = await handleRequest(
      makeRequest({
        headers: { 'idempotency-key': 'k-path' },
        body: baseBody({
          task: { title: 'T', instruction: 'I', allowed_files: ['ACTIVE.md'] },
        }),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(pathDenied.status, 403);
    assert.equal(JSON.parse(pathDenied.body).error, 'PATH_NOT_ALLOWED');

    const unauthorized = await handleRequest(
      new Request('https://broker.test/v1/executions/grok/draft-pr', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json', 'idempotency-key': 'k-auth' }),
        body: JSON.stringify(baseBody()),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(unauthorized.status, 401);
  });

  it('partial failures after write enter UNKNOWN and block retry', async () => {
    for (const stage of ['createRef', 'updateFile', 'createPullRequest']) {
      const runId = `run-${stage.toLowerCase()}`;
      const store = new MemoryBrokerStore();
      const env = {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store,
        github: githubMock({ throwAt: stage }),
        xai: { async generateDraftPrChange() { return xaiResponse(); } },
      };
      const key = `k-unknown-${stage}`;
      const first = await handleRequest(makeRequest({ headers: { 'idempotency-key': key }, body: baseBody({ run_id: runId }) }), env);
      assert.equal(first.status, 409, stage);
      assert.equal(JSON.parse(first.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      const idem = store.getIdem(key);
      assert.equal(idem?.state, IDEM_STATES.UNKNOWN);

      const retry = await handleRequest(makeRequest({ headers: { 'idempotency-key': key }, body: baseBody({ run_id: runId }) }), env);
      assert.equal(retry.status, 409, `${stage} retry`);
      assert.equal(JSON.parse(retry.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
    }
  });
});
