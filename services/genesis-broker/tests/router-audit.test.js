import { describe, it, beforeEach, afterEach } from 'node:test';
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
    return new Response(JSON.stringify({ message: `no mock` }), { status: 500 });
  };
}

function parseAudits(logs) {
  return logs
    .map((line) => {
      try {
        const o = JSON.parse(line);
        return o.audit || null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

describe('router audit completeness (console capture)', () => {
  let logs;
  let originalLog;

  beforeEach(() => {
    logs = [];
    originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  function lastAudit() {
    const audits = parseAudits(logs);
    return audits[audits.length - 1];
  }

  it('successful create → SUCCEEDED + GitHub 201', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues') && !u.includes('assignees'),
          response: () =>
            new Response(JSON.stringify({ number: 3, html_url: 'u', title: 'T' }), { status: 201 }),
        },
      ]),
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-ok' },
        body: {
          title: 'T',
          body: 'B',
          run_id: 'r-ok',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github },
    );
    assert.equal(res.status, 200);
    const a = lastAudit();
    assert.equal(a.idempotency_state, IDEM_STATES.SUCCEEDED);
    assert.equal(a.github_status, 201);
    assert.equal(typeof a.latency_ms, 'number');
    assert.ok(a.latency_ms >= 0);
  });

  it('deterministic GitHub 422 → FAILED + GitHub 422', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues'),
          response: () => new Response(JSON.stringify({ message: 'validation' }), { status: 422 }),
        },
      ]),
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-422' },
        body: {
          title: 'T',
          run_id: 'r-422',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github },
    );
    assert.equal(res.status, 422);
    const a = lastAudit();
    assert.equal(a.idempotency_state, IDEM_STATES.FAILED);
    assert.equal(a.github_status, 422);
  });

  it('GitHub throw → UNKNOWN', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: async () => {
        throw new Error('network');
      },
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-unk' },
        body: {
          title: 'T',
          run_id: 'r-unk',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github },
    );
    assert.equal(res.status, 409);
    const a = lastAudit();
    assert.equal(a.idempotency_state, IDEM_STATES.UNKNOWN);
    assert.equal(a.outcome, 'unknown');
  });

  it('replay → stored state + github_status null', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues'),
          response: () =>
            new Response(JSON.stringify({ number: 8, html_url: 'u', title: 'T' }), { status: 201 }),
        },
      ]),
    });
    const env = { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github };
    const body = {
      title: 'T',
      run_id: 'r-rep',
      gate: 'G1',
      confirmed_at: new Date().toISOString(),
    };
    await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-rep' },
        body,
      }),
      env,
    );
    logs.length = 0;
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-rep' },
        body: { ...body, confirmed_at: new Date().toISOString() },
      }),
      env,
    );
    assert.equal(res.status, 200);
    const a = lastAudit();
    assert.equal(a.outcome, 'replay');
    assert.equal(a.idempotency_state, IDEM_STATES.SUCCEEDED);
    assert.equal(a.github_status, null);
  });

  it('idempotency conflict → existing authoritative state SUCCEEDED', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'pat',
      fetchImpl: mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues'),
          response: () =>
            new Response(JSON.stringify({ number: 1, html_url: 'u', title: 'A' }), { status: 201 }),
        },
      ]),
    });
    const env = { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github };
    await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-cf' },
        body: {
          title: 'A',
          labels: ['bug'],
          run_id: 'r-cf',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    logs.length = 0;
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-cf' },
        body: {
          title: 'A',
          labels: ['enhancement'],
          run_id: 'r-cf',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      env,
    );
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).error, 'IDEMPOTENCY_CONFLICT');
    const a = lastAudit();
    assert.equal(a.idempotency_state, IDEM_STATES.SUCCEEDED);
    assert.equal(a.github_status, null);
  });

  it('invalid JSON → null GitHub/idempotency state', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-ij', 'content-type': 'application/json' },
        body: 'not-json{',
      }),
      {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store: new MemoryBrokerStore(),
        github: {},
      },
    );
    assert.equal(res.status, 400);
    const a = lastAudit();
    assert.equal(a.error, 'INVALID_JSON');
    assert.equal(a.github_status, null);
    assert.equal(a.idempotency_state, null);
    assert.ok(a.latency_ms >= 0);
  });

  it('repo denial → null GitHub/idempotency state', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-repo' },
        body: {
          title: 'T',
          repository: 'other/repo',
          run_id: 'r-repo',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store: new MemoryBrokerStore(),
        github: {},
      },
    );
    assert.equal(res.status, 403);
    const a = lastAudit();
    assert.equal(a.error, 'REPO_NOT_ALLOWED');
    assert.equal(a.github_status, null);
    assert.equal(a.idempotency_state, null);
  });

  it('PAT missing is audited', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'k-pat' },
        body: { title: 'T', run_id: 'r', gate: 'G1', confirmed_at: new Date().toISOString() },
      }),
      { BROKER_SERVICE_TOKEN: 'secret', store: new MemoryBrokerStore() },
    );
    assert.equal(res.status, 503);
    const a = lastAudit();
    assert.equal(a.error, 'PAT_NOT_CONFIGURED');
    assert.equal(a.github_status, null);
    assert.equal(a.idempotency_state, null);
  });

  it('serialized audit never contains Authorization, PAT or service token values', async () => {
    const store = new MemoryBrokerStore();
    const github = createGithubClient({
      pat: 'ghp_REALPATVALUE',
      fetchImpl: mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues'),
          response: () =>
            new Response(JSON.stringify({ number: 1, html_url: 'u', title: 'T' }), { status: 201 }),
        },
      ]),
    });
    await handleRequest(
      makeRequest('POST', '/v1/issues', {
        headers: { authorization: 'Bearer super-secret-token', 'idempotency-key': 'k-sec' },
        body: {
          title: 'T',
          run_id: 'r-sec',
          gate: 'G1',
          confirmed_at: new Date().toISOString(),
        },
      }),
      {
        BROKER_SERVICE_TOKEN: 'super-secret-token',
        GITHUB_PAT: 'ghp_REALPATVALUE',
        store,
        github,
      },
    );
    const blob = logs.join('\n');
    assert.equal(blob.includes('super-secret-token'), false);
    assert.equal(blob.includes('ghp_REALPATVALUE'), false);
    assert.equal(blob.includes('Authorization'), false);
  });
});
