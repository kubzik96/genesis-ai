/**
 * Crash-safe Durable Object idempotency tests.
 *
 * These tests use a mock state.storage that behaves like the Cloudflare DO
 * storage API (async get/put) to verify three crash-safety properties:
 *
 *   1. PENDING is persisted to DO storage BEFORE the upstream GitHub call.
 *   2. Reconstructing a new BrokerDurableObject from the same storage
 *      prevents a duplicate GitHub call (IN_FLIGHT → blocked).
 *   3. UNKNOWN state survives reconstruction and blocks retry.
 *
 * No Cloudflare runtime is required — all GitHub calls are mocked.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrokerDurableObject } from '../src/durable-object.js';
import { IDEM_STATES } from '../src/constants.js';

/* ── Mock helpers ─────────────────────────────────────────────────────────── */

/** Simple async key/value store mirroring the Cloudflare DO storage API. */
class MockStorage {
  constructor(initial = {}) {
    this._data = new Map(Object.entries(initial));
  }

  async get(key) {
    return this._data.has(key) ? this._data.get(key) : undefined;
  }

  async put(key, value) {
    this._data.set(key, value);
  }

  async delete(key) {
    this._data.delete(key);
  }

  /** Snapshot of the underlying map (for assertions). */
  snapshot() {
    return new Map(this._data);
  }
}

function makeState(storage) {
  return { storage };
}

function makeEnv(fetchImpl) {
  return { GITHUB_PAT: 'test-pat', _fetchImpl: fetchImpl };
}

/**
 * Build a minimal Request that BrokerDurableObject.fetch() can parse.
 */
function makeDoRequest(payload) {
  return new Request('https://do.internal/write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Create a BrokerDurableObject whose github client uses the given fetch mock.
 * We monkey-patch the global `fetch` inside the module by overriding the
 * createGithubClient default; instead, we patch the env so the github client
 * factory can pick it up.  Since createGithubClient takes `fetchImpl` as an
 * optional arg we must intercept at a higher level.
 *
 * Simplest approach: subclass BrokerDurableObject and override fetch() to
 * inject a mock github client.  But that couples the test to internals.
 *
 * Instead we use a minimal wrapper that calls the real fetch() but replaces
 * the global fetch before calling and restores it after.  This avoids any
 * coupling to private methods while still being a pure unit test.
 */
async function invokeDoFetch(storage, fetchImpl, payload) {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const do_ = new BrokerDurableObject(makeState(storage), { GITHUB_PAT: 'test-pat' });
    const req = makeDoRequest(payload);
    const res = await do_.fetch(req);
    return JSON.parse(await res.text());
  } finally {
    globalThis.fetch = savedFetch;
  }
}

function githubOk(overrides = {}) {
  return new Response(
    JSON.stringify({
      number: 7,
      html_url: 'https://github.com/kubzik96/genesis-ai/issues/7',
      title: 'Test issue',
      assignees: [],
      ...overrides,
    }),
    { status: 201 },
  );
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('BrokerDurableObject crash-safe idempotency', () => {
  it('PENDING is persisted to DO storage before GitHub call starts', async () => {
    const storage = new MockStorage();
    let pendingAtCallTime = null;

    const fetchImpl = async (url) => {
      // Capture what is in storage at the moment GitHub is called.
      pendingAtCallTime = await storage.get('idem:key-pending-test');
      return githubOk();
    };

    const payload = {
      idempotencyKey: 'key-pending-test',
      requestHash: 'hash-pending-test',
      operation: 'create_issue',
      runId: 'run-pending-test',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    };

    const result = await invokeDoFetch(storage, fetchImpl, payload);

    assert.equal(result.status, 200, 'expected 200 on success');
    assert.ok(pendingAtCallTime, 'idem record must exist in storage before GitHub call');
    assert.equal(
      pendingAtCallTime.state,
      IDEM_STATES.PENDING,
      'state must be PENDING at GitHub call time',
    );
    assert.equal(pendingAtCallTime.idempotency_key, 'key-pending-test');

    // Final state must be SUCCEEDED after the call.
    const final = await storage.get('idem:key-pending-test');
    assert.equal(final.state, IDEM_STATES.SUCCEEDED, 'final state must be SUCCEEDED');
  });

  it('reconstructing a new DO from the same storage prevents duplicate GitHub call', async () => {
    const storage = new MockStorage();
    let githubCallCount = 0;

    // First invocation: GitHub succeeds.
    const fetchImpl = async () => {
      githubCallCount += 1;
      return githubOk();
    };

    const payload = {
      idempotencyKey: 'key-reconstruct',
      requestHash: 'hash-reconstruct',
      operation: 'create_issue',
      runId: 'run-reconstruct',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    };

    const first = await invokeDoFetch(storage, fetchImpl, payload);
    assert.equal(first.status, 200);
    assert.equal(githubCallCount, 1);

    // Second invocation: a brand-new BrokerDurableObject instance sharing the
    // same storage (simulates DO reconstruction after eviction/crash).
    const second = await invokeDoFetch(storage, fetchImpl, payload);

    assert.equal(githubCallCount, 1, 'GitHub must NOT be called on the reconstructed DO');
    assert.equal(second.replay, true, 'second invocation must be a replay');
    assert.equal(second.body?.issue_number, 7, 'replayed body must match original result');
  });

  it('PENDING left in storage blocks duplicate call after crash (simulated mid-write crash)', async () => {
    const storage = new MockStorage();
    let githubCallCount = 0;

    // Simulate a DO crash: manually pre-seed storage with a PENDING record,
    // as if the DO wrote PENDING but crashed before calling GitHub.
    await storage.put('idem:key-crash', {
      idempotency_key: 'key-crash',
      request_hash: 'hash-crash',
      operation: 'create_issue',
      run_id: 'run-crash',
      gate: 'G1',
      state: IDEM_STATES.PENDING,
      safe_result: null,
    });

    // A reconstructed DO sees the PENDING record and must block without calling GitHub.
    const fetchImpl = async () => {
      githubCallCount += 1;
      return githubOk();
    };

    const result = await invokeDoFetch(storage, fetchImpl, {
      idempotencyKey: 'key-crash',
      requestHash: 'hash-crash',
      operation: 'create_issue',
      runId: 'run-crash',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    });

    assert.equal(githubCallCount, 0, 'GitHub must NOT be called when PENDING is found in storage');
    assert.equal(result.githubCalled, false);
    assert.equal(result.body?.error, 'IDEMPOTENCY_IN_FLIGHT');
  });

  it('UNKNOWN state survives reconstruction and blocks retry without another GitHub call', async () => {
    const storage = new MockStorage();
    let githubCallCount = 0;

    // First invocation: GitHub throws (indeterminate / UNKNOWN).
    const throwingFetch = async () => {
      githubCallCount += 1;
      throw new Error('network timeout');
    };

    const payload = {
      idempotencyKey: 'key-unknown',
      requestHash: 'hash-unknown',
      operation: 'create_issue',
      runId: 'run-unknown',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    };

    const first = await invokeDoFetch(storage, throwingFetch, payload);
    assert.equal(first.unknown, true);
    assert.equal(first.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
    assert.equal(githubCallCount, 1);

    // Verify UNKNOWN is persisted to DO storage.
    const stored = await storage.get('idem:key-unknown');
    assert.equal(stored?.state, IDEM_STATES.UNKNOWN, 'UNKNOWN must be persisted to storage');

    // Retry with a new DO instance sharing the same storage.
    const successFetch = async () => {
      githubCallCount += 1;
      return githubOk();
    };

    const retry = await invokeDoFetch(storage, successFetch, payload);

    assert.equal(githubCallCount, 1, 'GitHub must NOT be called on retry after UNKNOWN');
    assert.equal(retry.githubCalled, false);
    assert.equal(retry.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
  });
});
