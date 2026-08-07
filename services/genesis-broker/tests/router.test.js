import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/router.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { createGithubClient } from '../src/github-client.js';

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
    const key = `${method} ${u.replace('https://api.github.com', '')}`;
    for (const h of handlers) {
      if (h.match(method, u, init)) {
        return h.response();
      }
    }
    return new Response(JSON.stringify({ message: `no mock for ${key}` }), { status: 500 });
  };
}

describe('router', () => {
  it('health BLOCKED without PAT/DO', async () => {
    const res = await handleRequest(makeRequest('GET', '/v1/health'), {});
    assert.equal(res.status, 503);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'BLOCKED');
  });

  it('rejects unknown endpoint', async () => {
    const res = await handleRequest(makeRequest('POST', '/v1/merge'), {
      BROKER_SERVICE_TOKEN: 't',
      GITHUB_PAT: 'p',
      store: new MemoryBrokerStore(),
    });
    assert.equal(res.status, 404);
  });

  it('rejects request without service token', async () => {
    const res = await handleRequest(makeRequest('POST', '/v1/context/read', { body: { path: 'bridge/QUEUE.md' } }), {
      BROKER_SERVICE_TOKEN: 'secret',
      GITHUB_PAT: 'pat',
      store: new MemoryBrokerStore(),
      github: {},
    });
    assert.equal(res.status, 401);
  });

  it('rejects path outside allowlist', async () => {
    const res = await handleRequest(
      makeRequest('POST', '/v1/context/read', {
        headers: { authorization: 'Bearer secret' },
        body: { path: 'secrets/token.txt' },
      }),
      {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store: new MemoryBrokerStore(),
        github: { getContent: async () => ({ ok: true, data: {} }) },
      },
    );
    assert.equal(res.status, 403);
  });

  it('maps github 401/403/422 on create issue', async () => {
    for (const status of [401, 403, 422]) {
      const store = new MemoryBrokerStore();
      const fetchImpl = mockFetchFactory([
        {
          match: (m, u) => m === 'POST' && u.includes('/issues'),
          response: () => new Response(JSON.stringify({ message: 'fail' }), { status }),
        },
      ]);
      const github = createGithubClient({ pat: 'pat', fetchImpl });
      const res = await handleRequest(
        makeRequest('POST', '/v1/issues', {
          headers: {
            authorization: 'Bearer secret',
            'idempotency-key': `key-${status}`,
          },
          body: {
            title: 't',
            body: 'b',
            run_id: `run-${status}`,
            gate: 'G1',
            confirmed_at: new Date().toISOString(),
          },
        }),
        { BROKER_SERVICE_TOKEN: 'secret', GITHUB_PAT: 'pat', store, github },
      );
      assert.equal(res.status, status, `expected ${status}`);
    }
  });

  it('rejects assign for foreign issue', async () => {
    const store = new MemoryBrokerStore();
    await store.executeWrite({
      idempotencyKey: 'c1',
      requestHash: 'h',
      operation: 'create_issue',
      runId: 'run-x',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 5 } }),
    });
    const res = await handleRequest(
      makeRequest('POST', '/v1/issues/99/assign-copilot', {
        headers: { authorization: 'Bearer secret', 'idempotency-key': 'a1' },
        body: {
          run_id: 'run-x',
          gate: 'G2',
          confirmed_at: new Date().toISOString(),
        },
      }),
      {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store,
        github: createGithubClient({ pat: 'pat', fetchImpl: async () => new Response('{}', { status: 200 }) }),
      },
    );
    assert.equal(res.status, 403);
    assert.equal(JSON.parse(res.body).error, 'ISSUE_NOT_FROM_RUN');
  });
});
