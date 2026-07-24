/**
 * Crash-safe Durable Object idempotency tests.
 *
 * These tests use a mock state.storage that behaves like the Cloudflare DO
 * storage API (async get/put) to verify correctness properties:
 *
 *   1. PENDING is persisted to DO storage BEFORE the upstream GitHub call.
 *   2. Reconstructing a new BrokerDurableObject from the same storage
 *      prevents a duplicate GitHub call (IN_FLIGHT → blocked).
 *   3. UNKNOWN state survives reconstruction and blocks retry.
 *   4. Two concurrent requests with DIFFERENT idempotency keys but the same
 *      run_id produce only one upstream GitHub call (serialization lock).
 *   5. Successful finalization atomically updates idem + timestamps + run state.
 *   6. Missing state.storage returns BLOCKED and performs no GitHub call.
 *
 * No Cloudflare runtime is required — all GitHub calls are mocked via the
 * _fetchImpl env field (picked up by createGithubClient inside the DO).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrokerDurableObject } from '../src/durable-object.js';
import { IDEM_STATES } from '../src/constants.js';

/* ── Mock helpers ─────────────────────────────────────────────────────────── */

/**
 * Async key/value store mirroring the Cloudflare DO storage API.
 * Supports both single-key put(key, value) and batch put(Map).
 */
class MockStorage {
  constructor(initial = {}) {
    this._data = new Map(Object.entries(initial));
  }

  async get(key) {
    return this._data.has(key) ? this._data.get(key) : undefined;
  }

  async put(keyOrEntries, value) {
    if (keyOrEntries instanceof Map) {
      for (const [k, v] of keyOrEntries) {
        this._data.set(k, v);
      }
      return;
    }
    this._data.set(keyOrEntries, value);
  }

  async delete(key) {
    this._data.delete(key);
  }
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
 * Invoke BrokerDurableObject.fetch() on a fresh DO instance sharing the given
 * storage.  Simulates DO reconstruction between calls.
 * The fetchImpl is passed through env._fetchImpl so that createGithubClient
 * inside the DO uses it — no globalThis mutation required.
 */
async function invokeDoFetch(storage, fetchImpl, payload) {
  const do_ = new BrokerDurableObject(
    { storage },
    { GITHUB_PAT: 'test-pat', _fetchImpl: fetchImpl },
  );
  const res = await do_.fetch(makeDoRequest(payload));
  return JSON.parse(await res.text());
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

    const fetchImpl = async () => {
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

    // First invocation: GitHub succeeds.
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

  it('two concurrent requests with different keys and same run_id produce only one GitHub call', async () => {
    const storage = new MockStorage();
    let githubCallCount = 0;

    // Use a single shared DO instance — same as production (one DO per repo).
    const sharedDo = new BrokerDurableObject(
      { storage },
      {
        GITHUB_PAT: 'test-pat',
        _fetchImpl: async () => {
          githubCallCount += 1;
          // Small yield so the second enqueued request can be waiting when
          // the first is inside the GitHub await.
          await new Promise((r) => setTimeout(r, 5));
          return new Response(
            JSON.stringify({ number: 42, html_url: 'https://github.com/kubzik96/genesis-ai/issues/42', title: 'T', assignees: [] }),
            { status: 201 },
          );
        },
      },
    );

    const makePayload = (key) => ({
      idempotencyKey: key,
      requestHash: `hash-${key}`,
      operation: 'create_issue',
      runId: 'run-concurrent-diff',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    });

    const [r1, r2] = await Promise.all([
      sharedDo.fetch(makeDoRequest(makePayload('key-diff-a'))).then((r) => r.text()).then(JSON.parse),
      sharedDo.fetch(makeDoRequest(makePayload('key-diff-b'))).then((r) => r.text()).then(JSON.parse),
    ]);

    assert.equal(githubCallCount, 1, 'only one GitHub call must be made for the same run_id');

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    assert.equal(statuses[0], 200, 'one request must succeed');
    assert.equal(statuses[1], 429, 'second request must be blocked by run bounds');

    const blocked = r1.status === 429 ? r1 : r2;
    assert.equal(blocked.githubCalled, false, 'blocked request must not call GitHub');
  });

  it('success finalization atomically updates idem, timestamps, and run state', async () => {
    const storage = new MockStorage();

    await invokeDoFetch(
      storage,
      async () => new Response(
        JSON.stringify({ number: 10, html_url: '...', title: 'T', assignees: [] }),
        { status: 201 },
      ),
      {
        idempotencyKey: 'key-atomic',
        requestHash: 'hash-atomic',
        operation: 'create_issue',
        runId: 'run-atomic',
        gate: 'G1',
        operationData: { title: 'T', body: 'B', labels: [] },
      },
    );

    // All three must be present and consistent — written atomically as a batch.
    const idem = await storage.get('idem:key-atomic');
    const timestamps = await storage.get('rate:timestamps');
    const runState = await storage.get('run:run-atomic');

    assert.equal(idem?.state, IDEM_STATES.SUCCEEDED, 'idem must be SUCCEEDED');
    assert.ok(Array.isArray(timestamps) && timestamps.length > 0, 'timestamps must be updated');
    assert.equal(runState?.create_issue, true, 'run state must mark create_issue done');
    assert.equal(runState?.created_issue_number, 10, 'run state must record issue number');

    // New request with a different key but same run_id must be blocked — proving
    // the run state was atomically updated alongside SUCCEEDED.
    let extraGithubCalled = false;
    const followUp = await invokeDoFetch(
      storage,
      async () => { extraGithubCalled = true; return new Response(JSON.stringify({ number: 11 }), { status: 201 }); },
      {
        idempotencyKey: 'key-atomic-2',
        requestHash: 'hash-atomic-2',
        operation: 'create_issue',
        runId: 'run-atomic',
        gate: 'G1',
        operationData: { title: 'T2', body: 'B2', labels: [] },
      },
    );

    assert.equal(followUp.status, 429, 'second create in same run_id must be blocked');
    assert.equal(extraGithubCalled, false, 'GitHub must not be called for the blocked request');
  });

  it('missing state.storage returns BLOCKED and performs no GitHub call', async () => {
    let githubCallCount = 0;
    const fetchImpl = async () => {
      githubCallCount += 1;
      return new Response(JSON.stringify({ number: 1 }), { status: 201 });
    };

    // No storage property in state — simulates a DO runtime where storage is unavailable.
    const do_ = new BrokerDurableObject(
      { /* no storage */ },
      { GITHUB_PAT: 'test-pat', _fetchImpl: fetchImpl },
    );

    const res = await do_.fetch(makeDoRequest({
      idempotencyKey: 'key-nostorage',
      requestHash: 'hash-nostorage',
      operation: 'create_issue',
      runId: 'run-nostorage',
      gate: 'G1',
      operationData: { title: 'T', body: 'B', labels: [] },
    }));
    const result = JSON.parse(await res.text());

    assert.equal(result.status, 503, 'must return 503 when storage is missing');
    assert.equal(result.body?.error, 'BLOCKED', 'error must be BLOCKED');
    assert.equal(result.githubCalled, false, 'githubCalled must be false');
    assert.equal(githubCallCount, 0, 'GitHub must not be called when storage is missing');
  });
});
