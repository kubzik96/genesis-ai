import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/router.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { createGithubClient } from '../src/github-client.js';
import { IDEM_STATES } from '../src/constants.js';

function makeRequest(method, path, { headers = {}, body } = {}) {
  const init = { method, headers: new Headers(headers) };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers.set('content-type', 'application/json');
  }
  return new Request(`https://broker.test${path}`, init);
}

function mockFetchFactory(handlers) {
  return async (url, init = {}) => {
    const u = typeof url === 'string' ? url : url.url;
    const method = (init.method || 'GET').toUpperCase();
    for (const h of handlers) {
      if (h.match(method, u, init)) return h.response(init);
    }
    return new Response(JSON.stringify({ message: `no mock for ${method} ${u}` }), { status: 500 });
  };
}

function baseEnv(store, github) {
  return {
    BROKER_SERVICE_TOKEN: 'secret',
    GITHUB_PAT: 'pat',
    store,
    github,
  };
}

describe('canonical create_issue request_hash', () => {
  it('same key + different normalized labels → 409 IDEMPOTENCY_CONFLICT, no second GitHub call', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const fetchImpl = mockFetchFactory([
      {
        match: (m, u) => m === 'POST' && u.includes('/issues') && !u.includes('assignees'),
        response: () => {
          calls += 1;
          return new Response(
            JSON.stringify({ number: 10, html_url: 'https://github.com/x/y/issues/10', title: 'T' }),
            { status: 201 },
          );
        },
      },
    ]);
    const github = createGithubClient({ pat: 'pat', fetchImpl });
    const env = baseEnv(store, github);

    const first = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-labels' },
        body: {
          title: 'T',
          body: 'B',
          labels: ['bug'],
          run_id: 'run-labels',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(calls, 1);

    const second = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-labels' },
        body: {
          title: 'T',
          body: 'B',
          labels: ['enhancement'],
          run_id: 'run-labels',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    assert.equal(second.status, 409);
    assert.equal(JSON.parse(second.body).error, 'IDEMPOTENCY_CONFLICT');
    assert.equal(calls, 1, 'GitHub must not be called on conflict');
  });

  it('label order/whitespace variants produce same hash and replay', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const fetchImpl = mockFetchFactory([
      {
        match: (m, u) => m === 'POST' && u.includes('/issues') && !u.includes('assignees'),
        response: () => {
          calls += 1;
          return new Response(
            JSON.stringify({ number: 11, html_url: 'https://github.com/x/y/issues/11', title: 'T' }),
            { status: 201 },
          );
        },
      },
    ]);
    const github = createGithubClient({ pat: 'pat', fetchImpl });
    const env = baseEnv(store, github);

    const first = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-norm' },
        body: {
          title: 'T',
          body: 'B',
          labels: [' bug ', 'enhancement', 'bug'],
          run_id: 'run-norm',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(calls, 1);

    const second = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-norm' },
        body: {
          title: 'T',
          body: 'B',
          labels: ['enhancement', 'bug'],
          run_id: 'run-norm',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    assert.equal(second.status, 200);
    assert.equal(JSON.parse(second.body).issue_number, 11);
    assert.equal(calls, 1, 'replay must not call GitHub');
  });

  it('invalid labels → 400 before store/GitHub', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: async () => {
        calls += 1;
        return new Response('{}', { status: 201 });
      },
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-bad-labels' },
        body: {
          title: 'T',
          labels: [1],
          run_id: 'run-bad',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      baseEnv(store, github),
    );
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error, 'INVALID_LABELS');
    assert.equal(calls, 0);
    assert.equal(store.getIdem('k-bad-labels'), null);
  });

  it('empty or invalid title → 400 before store/GitHub', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: async () => {
        calls += 1;
        return new Response('{}', { status: 201 });
      },
    });
    for (const title of ['', '   ', null, 123]) {
      const res = await handleRequest(
        makeRequest('POST', '/v1/issues', {
          headers: { authorization: 'Bearer secret', 'idempotency-key': `k-title-${title}` },
          body: {
            title,
            run_id: 'run-title',
            gate: 'G1',
            confirmed_at: new Date().toISOString(),
          },
        }),
        baseEnv(store, github),
      );
      assert.equal(res.status, 400, `title=${JSON.stringify(title)}`);
      assert.equal(JSON.parse(res.body).error, 'INVALID_TITLE');
    }
    assert.equal(calls, 0);
  });

  it('invalid body type → 400 before store/GitHub', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: async () => {
        calls += 1;
        return new Response('{}', { status: 201 });
      },
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-body' },
        body: {
          title: 'T',
          body: { not: 'string' },
          run_id: 'run-body',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      baseEnv(store, github),
    );
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error, 'INVALID_BODY');
    assert.equal(calls, 0);
  });

  it('different valid confirmed_at with same side-effect does not cause IDEMPOTENCY_CONFLICT', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const fetchImpl = mockFetchFactory([
      {
        match: (m, u) => m === 'POST' && u.includes('/issues') && !u.includes('assignees'),
        response: () => {
          calls += 1;
          return new Response(
            JSON.stringify({ number: 20, html_url: 'https://github.com/x/y/issues/20', title: 'T' }),
            { status: 201 },
          );
        },
      },
    ]);
    const github = createGithubClient({ pat: 'pat', fetchImpl });
    const env = baseEnv(store, github);

    const t1 = new Date().toISOString();
    const first = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-conf' },
        body: {
          title: 'Same',
          body: 'Body',
          labels: ['a'],
          run_id: 'run-conf',
          gate: 'G1',
          confirmed_at: t1,
        },
      }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(calls, 1);

    const t2 = new Date(Date.now() - 30_000).toISOString();
    const second = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-conf' },
        body: {
          title: 'Same',
          body: 'Body',
          labels: ['a'],
          run_id: 'run-conf',
          gate: 'G1',
          confirmed_at: t2,
        },
      }),
      env,
    );
    assert.equal(second.status, 200);
    assert.notEqual(JSON.parse(second.body).error, 'IDEMPOTENCY_CONFLICT');
    assert.equal(JSON.parse(second.body).issue_number, 20);
    assert.equal(calls, 1, 'must replay without second GitHub call');
  });
});

describe('audit §4.8 fields via store result contract', () => {
  it('success returns SUCCEEDED + githubStatus', async () => {
    const store = new MemoryBrokerStore();
    const r = await store.executeWrite({
      idempotencyKey: 'a-ok',
      requestHash: 'h-ok',
      operation: 'create_issue',
      runId: 'r-ok',
      gate: 'G1',
      githubCall: async () => ({
        ok: true,
        status: 200,
        githubStatus: 201,
        safeResult: { issue_number: 1 },
      }),
    });
    assert.equal(r.idempotencyState, IDEM_STATES.SUCCEEDED);
    assert.equal(r.githubStatus, 201);
    assert.equal(r.githubCalled, true);
  });

  it('deterministic 4xx returns FAILED + githubStatus', async () => {
    const store = new MemoryBrokerStore();
    const r = await store.executeWrite({
      idempotencyKey: 'a-fail',
      requestHash: 'h-fail',
      operation: 'create_issue',
      runId: 'r-fail',
      gate: 'G1',
      githubCall: async () => ({
        ok: false,
        status: 422,
        githubStatus: 422,
        safeResult: { error: 'GITHUB_422', message: 'validation', status: 422 },
      }),
    });
    assert.equal(r.idempotencyState, IDEM_STATES.FAILED);
    assert.equal(r.githubStatus, 422);
    assert.equal(r.status, 422);
  });

  it('throw returns UNKNOWN with null githubStatus', async () => {
    const store = new MemoryBrokerStore();
    const r = await store.executeWrite({
      idempotencyKey: 'a-unk',
      requestHash: 'h-unk',
      operation: 'create_issue',
      runId: 'r-unk',
      gate: 'G1',
      githubCall: async () => {
        throw new Error('timeout');
      },
    });
    assert.equal(r.idempotencyState, IDEM_STATES.UNKNOWN);
    assert.equal(r.githubStatus, null);
    assert.equal(r.unknown, true);
  });

  it('replay returns stored state and null githubStatus', async () => {
    const store = new MemoryBrokerStore();
    await store.executeWrite({
      idempotencyKey: 'a-rep',
      requestHash: 'h-rep',
      operation: 'create_issue',
      runId: 'r-rep',
      gate: 'G1',
      githubCall: async () => ({
        ok: true,
        status: 200,
        githubStatus: 201,
        safeResult: { issue_number: 9 },
      }),
    });
    const r = await store.executeWrite({
      idempotencyKey: 'a-rep',
      requestHash: 'h-rep',
      operation: 'create_issue',
      runId: 'r-rep',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 99 } }),
    });
    assert.equal(r.replay, true);
    assert.equal(r.idempotencyState, IDEM_STATES.SUCCEEDED);
    assert.equal(r.githubStatus, null);
    assert.equal(r.githubCalled, false);
  });

  it('pre-store rejection paths expose null state/status', async () => {
    const store = new MemoryBrokerStore();
    // Seed one success so second create same run is rate-bounded without GitHub.
    await store.executeWrite({
      idempotencyKey: 'a-pre1',
      requestHash: 'h-pre1',
      operation: 'create_issue',
      runId: 'r-pre',
      gate: 'G1',
      githubCall: async () => ({
        ok: true,
        status: 200,
        githubStatus: 201,
        safeResult: { issue_number: 1 },
      }),
    });
    const r = await store.executeWrite({
      idempotencyKey: 'a-pre2',
      requestHash: 'h-pre2',
      operation: 'create_issue',
      runId: 'r-pre',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 2 } }),
    });
    assert.equal(r.status, 429);
    assert.equal(r.githubCalled, false);
    assert.equal(r.githubStatus, null);
    assert.equal(r.idempotencyState, null);
  });
});
