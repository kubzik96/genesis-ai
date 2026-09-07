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
 * Supports single-key put(key, value) and multi-key batch put(entries: Object).
 * The multi-key overload matches the documented production API:
 *   storage.put(Object.fromEntries(pairs)) — plain Object, no Map.
 */
class MockStorage {
  constructor(initial = {}) {
    this._data = new Map(Object.entries(initial));
  }

  async get(key) {
    return this._data.has(key) ? this._data.get(key) : undefined;
  }

  async put(keyOrEntries, value) {
    if (typeof keyOrEntries === 'object' && keyOrEntries !== null && value === undefined) {
      // Multi-key batch put: put(entries: Record<string, unknown>)
      for (const [k, v] of Object.entries(keyOrEntries)) {
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

const GROK_BASE_SHA = 'a'.repeat(40);
const GROK_BLOB_SHA = 'b'.repeat(40);
const GROK_COMMIT_SHA = 'c'.repeat(40);

function sumStage1Calls(calls) {
  return calls.getRef + calls.getContentAtRef + calls.createRef + calls.updateFile + calls.createPullRequest;
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

  function makeStage1GithubMock({
    updateFileStatus = 200,
    pullStatus = 201,
    updateFileResponse = null,
    pullResponse = null,
    throwAt = null,
  } = {}) {
    const calls = { getRef: 0, getContentAtRef: 0, createRef: 0, updateFile: 0, createPullRequest: 0 };
    return {
      __stage1Mock: true,
      calls,
      async getRef() {
        calls.getRef += 1;
        return { ok: true, status: 200, data: { object: { sha: GROK_BASE_SHA } } };
      },
      async getContentAtRef() {
        calls.getContentAtRef += 1;
        return {
          ok: true,
          status: 200,
          data: { sha: GROK_BLOB_SHA, encoding: 'base64', content: btoa('line1\nline2\nline3\n') },
        };
      },
      async createRef() {
        calls.createRef += 1;
        if (throwAt === 'createRef') throw new Error('timeout');
        return { ok: true, status: 201, data: {} };
      },
      async updateFile() {
        calls.updateFile += 1;
        if (throwAt === 'updateFile') throw new Error('timeout');
        if (updateFileResponse) return updateFileResponse;
        if (updateFileStatus >= 400) return { ok: false, status: updateFileStatus, data: { message: 'fail' } };
        return { ok: true, status: updateFileStatus, data: { commit: { sha: GROK_COMMIT_SHA } } };
      },
      async createPullRequest(args) {
        calls.createPullRequest += 1;
        if (throwAt === 'createPullRequest') throw new Error('timeout');
        if (pullResponse) return pullResponse;
        if (pullStatus >= 400) return { ok: false, status: pullStatus, data: { message: 'fail' } };
        return {
          ok: true,
          status: 201,
          data: {
            number: 123,
            html_url: 'https://github.com/kubzik96/genesis-ai/pull/123',
            draft: true,
            head: { ref: args.head, sha: GROK_COMMIT_SHA },
            base: { ref: args.base },
          },
        };
      },
    };
  }

  function makeStage1XaiMock(change = 'line1\nline-two\nline3\n') {
    return {
      __stage1Mock: true,
      calls: 0,
      async generateDraftPrChange() {
        this.calls += 1;
        return {
          summary: 'update',
          self_check: { scope_ok: true },
          changes: [{ path: 'MEMORY.md', expected_blob_sha: GROK_BLOB_SHA, new_content: change }],
        };
      },
    };
  }

  function makeGrokDoPayload({ key, hash, runId = 'run-1' }) {
    return {
      idempotencyKey: key,
      requestHash: hash,
      operation: 'create_branch_commit_draft_pr',
      runId,
      gate: 'G2',
      operationData: {
        runId,
        gate: 'G2',
        confirmedAt: new Date().toISOString(),
        baseSha: GROK_BASE_SHA,
        task: {
          title: 'Update memory',
          instruction: 'Change one line',
          allowedFiles: ['MEMORY.md'],
        },
      },
    };
  }

  describe('BrokerDurableObject grok draft-pr authoritative state', () => {
    it('persists PENDING before first possible Stage 1 write and replays after reconstruction', async () => {
      const storage = new MockStorage();
      const github = makeStage1GithubMock();
      const xai = makeStage1XaiMock();
      let pendingAtCreateRef = null;
      let runStateAtCreateRef = null;
      const wrappedGithub = {
        ...github,
        async createRef(...args) {
          pendingAtCreateRef = await storage.get('idem:key-grok-pending');
          runStateAtCreateRef = await storage.get('run:run-1');
          return github.createRef(...args);
        },
      };
      const payload = makeGrokDoPayload({ key: 'key-grok-pending', hash: 'hash-grok-pending' });
      const first = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: wrappedGithub, _xai: xai },
      ).fetch(makeDoRequest(payload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(first.status, 200);
      assert.equal(pendingAtCreateRef?.state, IDEM_STATES.PENDING);
      assert.equal(
        runStateAtCreateRef?.create_branch_commit_draft_pr_pending?.idempotency_key,
        'key-grok-pending',
      );

      const replay = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: wrappedGithub, _xai: xai },
      ).fetch(makeDoRequest(payload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(replay.status, 200);
      assert.equal(replay.replay, true);
      assert.equal(github.calls.createRef, 1);
    });

    it('same key different hash conflicts after reconstruction without Stage 1 calls', async () => {
      const storage = new MockStorage();
      const github = makeStage1GithubMock();
      const xai = makeStage1XaiMock();
      const payload = makeGrokDoPayload({ key: 'key-grok-conflict', hash: 'hash-a' });
      const first = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(payload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(first.status, 200);

      const conflict = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest({ ...payload, requestHash: 'hash-b' })).then((r) => r.text()).then(JSON.parse);
      assert.equal(conflict.status, 409);
      assert.equal(conflict.body?.error, 'IDEMPOTENCY_CONFLICT');
      assert.equal(github.calls.createRef, 1);
    });

    it('post-branch UNKNOWN survives reconstruction and blocks new key without retry', async () => {
      const storage = new MockStorage();
      const github = makeStage1GithubMock({ updateFileStatus: 422 });
      const xai = makeStage1XaiMock();
      const firstPayload = makeGrokDoPayload({ key: 'key-grok-unknown', hash: 'hash-grok-unknown', runId: 'run-grok-unknown' });
      const first = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(firstPayload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(first.status, 409);
      assert.equal(first.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(github.calls.createRef, 1);
      assert.equal(github.calls.updateFile, 1);

      const retrySameKey = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(firstPayload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(retrySameKey.status, 409);
      assert.equal(retrySameKey.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');

      const retryNewKey = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(makeGrokDoPayload({ key: 'key-grok-unknown-2', hash: 'hash-grok-unknown-2', runId: 'run-grok-unknown' })))
        .then((r) => r.text()).then(JSON.parse);
      assert.equal(retryNewKey.status, 409);
      assert.equal(retryNewKey.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(github.calls.createRef, 1);
      assert.equal(github.calls.updateFile, 1);
      assert.equal(github.calls.createPullRequest, 0);
    });

    it('active per-run reservation blocks new key after reconstruction and preserves same-key semantics', async () => {
      const storage = new MockStorage();
      await storage.put(Object.fromEntries([
        ['idem:key-grok-active', {
          idempotency_key: 'key-grok-active',
          request_hash: 'hash-grok-active',
          operation: 'create_branch_commit_draft_pr',
          run_id: 'run-grok-active',
          gate: 'G2',
          state: IDEM_STATES.PENDING,
          safe_result: null,
        }],
        ['run:run-grok-active', {
          create_issue: false,
          assign_copilot: false,
          create_branch_commit_draft_pr: false,
          create_branch_commit_draft_pr_blocked: false,
          create_branch_commit_draft_pr_pending: {
            idempotency_key: 'key-grok-active',
            request_hash: 'hash-grok-active',
          },
          created_issue_number: null,
        }],
      ]));
      const github = makeStage1GithubMock();
      const xai = makeStage1XaiMock();

      const blockedNewKey = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(makeGrokDoPayload({
        key: 'key-grok-active-2',
        hash: 'hash-grok-active-2',
        runId: 'run-grok-active',
      }))).then((r) => r.text()).then(JSON.parse);
      assert.equal(blockedNewKey.status, 409);
      assert.equal(blockedNewKey.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(sumStage1Calls(github.calls), 0);
      assert.equal(xai.calls, 0);

      const inFlightSameKey = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(makeGrokDoPayload({
        key: 'key-grok-active',
        hash: 'hash-grok-active',
        runId: 'run-grok-active',
      }))).then((r) => r.text()).then(JSON.parse);
      assert.equal(inFlightSameKey.status, 409);
      assert.equal(inFlightSameKey.body?.error, 'IDEMPOTENCY_IN_FLIGHT');
      assert.equal(sumStage1Calls(github.calls), 0);
      assert.equal(xai.calls, 0);

      const conflictSameKey = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(makeGrokDoPayload({
        key: 'key-grok-active',
        hash: 'hash-grok-active-diff',
        runId: 'run-grok-active',
      }))).then((r) => r.text()).then(JSON.parse);
      assert.equal(conflictSameKey.status, 409);
      assert.equal(conflictSameKey.body?.error, 'IDEMPOTENCY_CONFLICT');
      assert.equal(sumStage1Calls(github.calls), 0);
      assert.equal(xai.calls, 0);
    });

    it('deterministic pre-branch failure clears reservation and allows safe next-key retry', async () => {
      const storage = new MockStorage();
      const github = makeStage1GithubMock();
      const xai = makeStage1XaiMock();
      const runId = 'run-grok-prebranch-fail';
      const firstPayload = makeGrokDoPayload({ key: 'key-grok-prebranch-fail', hash: 'hash-grok-prebranch-fail', runId });
      firstPayload.operationData.baseSha = 'd'.repeat(40);

      const first = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(firstPayload)).then((r) => r.text()).then(JSON.parse);
      assert.equal(first.status, 409);
      assert.equal(first.idempotencyState, IDEM_STATES.FAILED);
      assert.equal(github.calls.createRef, 0);
      assert.equal(xai.calls, 0);

      const runAfterFail = await storage.get(`run:${runId}`);
      assert.equal(runAfterFail?.create_branch_commit_draft_pr_pending, null);
      assert.equal(runAfterFail?.create_branch_commit_draft_pr_blocked, false);
      assert.equal(runAfterFail?.create_branch_commit_draft_pr, false);

      const second = await new BrokerDurableObject(
        { storage },
        { GITHUB_PAT: 'pat', _github: github, _xai: xai },
      ).fetch(makeDoRequest(makeGrokDoPayload({
        key: 'key-grok-prebranch-fail-2',
        hash: 'hash-grok-prebranch-fail-2',
        runId,
      }))).then((r) => r.text()).then(JSON.parse);
      assert.equal(second.status, 200);
      assert.equal(github.calls.createRef, 1);
      assert.equal(github.calls.updateFile, 1);
      assert.equal(github.calls.createPullRequest, 1);
      assert.equal(xai.calls, 1);
    });

    it('default-off production guard blocks operation on DO path when test adapters are missing', async () => {
      const storage = new MockStorage();
      const result = await invokeDoFetch(
        storage,
        async () => new Response(JSON.stringify({ message: 'should-not-run' }), { status: 500 }),
        makeGrokDoPayload({ key: 'key-grok-no-mocks', hash: 'hash-grok-no-mocks' }),
      );
      assert.equal(result.status, 503);
      assert.equal(result.body?.error, 'EXECUTOR_DISABLED');
    });

    it('existing S-0002 create/assign flow remains unchanged via DO fetch boundary', async () => {
      const storage = new MockStorage();
      const queue = [];
      const fetchImpl = async (_url, init) => {
        queue.push({ url: _url, method: init?.method });
        if (queue.length === 1) {
          return new Response(
            JSON.stringify({ number: 42, html_url: 'https://github.com/kubzik96/genesis-ai/issues/42', title: 'Test', assignees: [] }),
            { status: 201 },
          );
        }
        return new Response(
          JSON.stringify({ assignees: [{ login: 'copilot-swe-agent[bot]' }] }),
          { status: 200 },
        );
      };
      const create = await invokeDoFetch(storage, fetchImpl, {
        idempotencyKey: 'key-create',
        requestHash: 'hash-create',
        operation: 'create_issue',
        runId: 'run-create-assign',
        gate: 'G1',
        operationData: { title: 'T', body: 'B', labels: [] },
      });
      assert.equal(create.status, 200);
      const assign = await invokeDoFetch(storage, fetchImpl, {
        idempotencyKey: 'key-assign',
        requestHash: 'hash-assign',
        operation: 'assign_copilot',
        runId: 'run-create-assign',
        gate: 'G2',
        operationData: { issueNumber: 42 },
      });
      assert.equal(assign.status, 200);
      assert.equal(assign.body?.issue_number, 42);
      assert.equal(queue.length, 2);
    });
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

    // Gate blocks the GitHub call until both requests are queued — deterministic.
    let unblockGithub;
    const githubGate = new Promise((r) => { unblockGithub = r; });

    // Use a single shared DO instance — same as production (one DO per repo).
    const sharedDo = new BrokerDurableObject(
      { storage },
      {
        GITHUB_PAT: 'test-pat',
        _fetchImpl: async () => {
          githubCallCount += 1;
          await githubGate; // hold until the test signals both requests are queued
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

    // Start both fetches — neither can finish until the gate is opened.
    const p1 = sharedDo.fetch(makeDoRequest(makePayload('key-diff-a'))).then((r) => r.text()).then(JSON.parse);
    const p2 = sharedDo.fetch(makeDoRequest(makePayload('key-diff-b'))).then((r) => r.text()).then(JSON.parse);

    // Flush all pending microtasks (both request.json() calls + _withLock queuing).
    await new Promise((r) => setTimeout(r, 0));

    // Unblock GitHub — at this point both requests have called _withLock,
    // so the second is definitely queued behind the first.
    unblockGithub();

    const [r1, r2] = await Promise.all([p1, p2]);

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

describe('BrokerDurableObject reviewer authorization durability', () => {
  const REVIEW_HEAD = 'd'.repeat(40);
  const REVIEW_FORBIDDEN = [
    'READY', 'MERGE', 'REMEDIATION', 'DEPLOY', 'DIFY', 'BROKER_AUTH_RUNTIME',
    'CLOUDFLARE', 'SECRETS', 'QUARANTINE_REMOVAL', 'REPEAT_MODEL_CALL',
  ];

  function reviewAuthorization() {
    return {
      repository: 'kubzik96/genesis-ai',
      prNumber: 95,
      expectedHeadSha: REVIEW_HEAD,
      reviewPurpose: 'Durable reviewer test',
      criteria: ['Preserve S-0010'],
      artifactProducer: 'CODEX',
      modelCallAuthorized: true,
      modelRequestLimit: 1,
      durablePersistenceAuthorized: true,
      forbiddenActions: [...REVIEW_FORBIDDEN],
    };
  }

  function reviewPayload({ key = 'review-key', hash = 'review-hash', runId = 'review-run' } = {}) {
    return {
      idempotencyKey: key,
      requestHash: hash,
      operation: 'review_grok',
      runId,
      authorization: reviewAuthorization(),
      context: 'bounded canonical context',
    };
  }

  function reviewGithub({ throwInitial = false, throwPersist = false } = {}) {
    let persistedBody = null;
    const calls = { getPull: 0, addIssueComment: 0, getIssueComment: 0 };
    return {
      calls,
      async getPull() {
        calls.getPull += 1;
        if (throwInitial && calls.getPull === 1) throw new Error('network');
        return { ok: true, status: 200, data: { head: { sha: REVIEW_HEAD } } };
      },
      async getPullFiles() {
        return { ok: true, status: 200, data: [{ filename: 'MEMORY.md', status: 'modified' }], headers: new Headers() };
      },
      async getPullDiff() {
        return { ok: true, status: 200, data: 'diff --git a/MEMORY.md b/MEMORY.md\n+safe', headers: new Headers() };
      },
      async addIssueComment(_number, body) {
        calls.addIssueComment += 1;
        persistedBody = body;
        if (throwPersist) throw new Error('timeout');
        return { ok: true, status: 201, data: { id: 777 } };
      },
      async getIssueComment() {
        calls.getIssueComment += 1;
        return {
          ok: true,
          status: 200,
          data: {
            issue_url: 'https://api.github.com/repos/kubzik96/genesis-ai/issues/95',
            body: persistedBody,
          },
        };
      },
    };
  }

  function reviewClient(storage, { fail = false, delay = false } = {}) {
    const state = { calls: 0, pendingAtCall: null };
    return {
      state,
      async review() {
        state.calls += 1;
        state.pendingAtCall = await storage.get('idem:review-key');
        if (delay) await new Promise((resolve) => setTimeout(resolve, 5));
        if (fail) throw new Error('provider');
        return {
          verdict: 'APPROVE',
          reviewed_head_sha: REVIEW_HEAD,
          head_confirmed: 'YES',
          scope: 'CLEAN',
          findings: [],
          ready_gate_safe: 'YES',
        };
      },
    };
  }

  async function invokeReview(storage, github, client, payload) {
    const instance = new BrokerDurableObject(
      { storage },
      { GITHUB_PAT: 'pat', _github: github, _reviewClient: client },
    );
    return instance.fetch(makeDoRequest(payload)).then((r) => r.text()).then(JSON.parse);
  }

  it('rejects a live production path with no API key before durable reservation', async () => {
    const storage = new MockStorage();
    const github = reviewGithub();
    const instance = new BrokerDurableObject(
      { storage },
      { GITHUB_PAT: 'pat', _github: github, XAI_REVIEWER_LIVE_ENABLED: 'true' },
    );
    const result = await instance.fetch(makeDoRequest(reviewPayload())).then((r) => r.text()).then(JSON.parse);
    assert.equal(result.status, 503);
    assert.equal(result.body?.error, 'REVIEW_PRODUCTION_UNAVAILABLE');
    assert.equal(await storage.get('idem:review-key'), undefined);
    assert.equal(github.calls.getPull, 0);
  });

  it('atomically reserves before the model, then replays after reconstruction', async () => {
    const storage = new MockStorage();
    const github = reviewGithub();
    const client = reviewClient(storage);
    const payload = reviewPayload();
    const first = await invokeReview(storage, github, client, payload);
    assert.equal(first.status, 200);
    assert.equal(client.state.calls, 1);
    assert.equal(client.state.pendingAtCall?.state, IDEM_STATES.PENDING);
    assert.equal((await storage.get('run:review-run'))?.review_grok, true);

    const replay = await invokeReview(storage, github, client, payload);
    assert.equal(replay.status, first.status);
    assert.deepEqual(replay.body, first.body);
    assert.equal(replay.replay, true);
    assert.equal(client.state.calls, 1);
    assert.equal(github.calls.addIssueComment, 1);
  });

  async function prepareSuccessfulReplay() {
    const storage = new MockStorage();
    const github = reviewGithub();
    const client = reviewClient(storage);
    const payload = reviewPayload();
    const first = await invokeReview(storage, github, client, payload);
    assert.equal(first.status, 200);
    assert.equal(first.body.ready_gate_safe, 'YES');
    assert.equal(first.body.consequential_gate_evidence_available, true);
    const storedBefore = structuredClone(storage._data);
    const callsBefore = { ...github.calls };
    let storageWrites = 0;
    const put = storage.put.bind(storage);
    storage.put = async (...args) => {
      storageWrites += 1;
      return put(...args);
    };
    return {
      storage, github, client, payload, first,
      assertReadOnlyReplay(replay, headReads = 1) {
        assert.equal(replay.replay, true);
        assert.equal(replay.idempotencyState, IDEM_STATES.SUCCEEDED);
        assert.equal(replay.githubCalled, headReads > 0);
        assert.equal(replay.modelCalled, false);
        assert.equal(replay.persistenceAttempted, false);
        assert.equal(client.state.calls, 1, 'only the initial review may call the model');
        assert.deepEqual(github.calls, { ...callsBefore, getPull: callsBefore.getPull + headReads });
        assert.equal(github.calls.addIssueComment, 1, 'only the initial evidence may be persisted');
        assert.equal(storageWrites, 0, 'replay must not write durable state');
        assert.deepEqual(storage._data, storedBefore, 'historical result and authorization state stay immutable');
      },
    };
  }

  function assertBlockedReplay(replay, code) {
    assert.equal(replay.status, 409);
    assert.equal(replay.body.ok, false);
    assert.equal(replay.body.code, code);
    assert.equal(replay.body.verdict, 'BLOCKED');
    assert.equal(replay.body.head_confirmed, 'NO');
    assert.equal(replay.body.ready_gate_safe, 'NO');
    assert.equal(replay.body.consequential_gate_evidence_available, false);
    assert.equal(replay.body.next_action, 'STOP_BLOCKED');
  }

  for (const currentHead of [REVIEW_HEAD, REVIEW_HEAD.toUpperCase()]) {
    it(`F1 T1 rechecks same HEAD ${currentHead.slice(0, 7)} and replays the immutable result`, async () => {
      const fixture = await prepareSuccessfulReplay();
      const { storage, github, client, payload, first } = fixture;
      github.getPull = async (prNumber) => {
        github.calls.getPull += 1;
        assert.equal(prNumber, payload.authorization.prNumber);
        return { ok: true, status: 200, data: { head: { sha: currentHead } } };
      };
      const replay = await invokeReview(storage, github, client, payload);
      assert.equal(replay.status, first.status);
      assert.deepEqual(replay.body, first.body);
      assert.equal(replay.githubStatus, 200);
      fixture.assertReadOnlyReplay(replay);
    });
  }

  it('F1 T2 blocks a successful replay after HEAD changes without replacing historical evidence', async () => {
    const fixture = await prepareSuccessfulReplay();
    const { storage, github, client, payload } = fixture;
    github.getPull = async () => {
      github.calls.getPull += 1;
      return { ok: true, status: 200, data: { head: { sha: 'e'.repeat(40) } } };
    };
    const replay = await invokeReview(storage, github, client, payload);
    assertBlockedReplay(replay, 'ACCEPTANCE_HEAD_MISMATCH');
    fixture.assertReadOnlyReplay(replay);
  });

  const unreadableHeads = [
    ['throwing read', () => { throw new Error('network'); }],
    ['failed read', () => ({ ok: false, status: 503, data: {} })],
    ['missing response', () => undefined],
    ['missing HEAD', () => ({ ok: true, status: 200, data: {} })],
    ['short SHA', () => ({ ok: true, status: 200, data: { head: { sha: 'd'.repeat(39) } } })],
    ['non-hex SHA', () => ({ ok: true, status: 200, data: { head: { sha: 'z'.repeat(40) } } })],
    ['ambiguous SHA array', () => ({ ok: true, status: 200, data: { head: { sha: [REVIEW_HEAD] } } })],
    ['contradictory status', () => ({ ok: true, status: 503, data: { head: { sha: REVIEW_HEAD } } })],
    ['non-boolean success', () => ({ ok: 'true', status: 200, data: { head: { sha: REVIEW_HEAD } } })],
  ];
  for (const [label, readHead] of unreadableHeads) {
    it(`F1 T3 fails closed on ${label} during replay without retry`, async () => {
      const fixture = await prepareSuccessfulReplay();
      const { storage, github, client, payload } = fixture;
      github.getPull = async () => {
        github.calls.getPull += 1;
        return readHead();
      };
      const replay = await invokeReview(storage, github, client, payload);
      assertBlockedReplay(replay, 'HEAD_READ_FAILED');
      fixture.assertReadOnlyReplay(replay);
    });
  }

  it('F1 T3 fails closed when the HEAD reader is unavailable', async () => {
    const fixture = await prepareSuccessfulReplay();
    const { storage, github, client, payload } = fixture;
    github.getPull = undefined;
    const replay = await invokeReview(storage, github, client, payload);
    assertBlockedReplay(replay, 'HEAD_READ_FAILED');
    fixture.assertReadOnlyReplay(replay, 0);
  });

  it('blocks same-key hash conflict and a different key for a consumed run', async () => {
    const storage = new MockStorage();
    const github = reviewGithub();
    const client = reviewClient(storage);
    await invokeReview(storage, github, client, reviewPayload());

    const conflict = await invokeReview(storage, github, client, reviewPayload({ hash: 'different-hash' }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body?.error, 'IDEMPOTENCY_CONFLICT');

    const secondKey = await invokeReview(storage, github, client, reviewPayload({ key: 'review-key-2', hash: 'review-hash-2' }));
    assert.equal(secondKey.status, 429);
    assert.equal(client.state.calls, 1);
    assert.equal(github.calls.addIssueComment, 1);
  });

  it('serializes concurrent different keys for one run and performs one model call', async () => {
    const storage = new MockStorage();
    const github = reviewGithub();
    const client = reviewClient(storage, { delay: true });
    const instance = new BrokerDurableObject(
      { storage },
      { GITHUB_PAT: 'pat', _github: github, _reviewClient: client },
    );
    const invoke = (payload) => instance.fetch(makeDoRequest(payload)).then((r) => r.text()).then(JSON.parse);
    const [first, second] = await Promise.all([
      invoke(reviewPayload()),
      invoke(reviewPayload({ key: 'review-key-2', hash: 'review-hash-2' })),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(client.state.calls, 1);
    assert.equal(github.calls.addIssueComment, 1);
  });

  it('persists UNKNOWN on an indeterminate evidence write and blocks reconstruction', async () => {
    const storage = new MockStorage();
    const github = reviewGithub({ throwPersist: true });
    const client = reviewClient(storage);
    const first = await invokeReview(storage, github, client, reviewPayload());
    assert.equal(first.status, 409);
    assert.equal(first.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
    assert.equal((await storage.get('idem:review-key'))?.state, IDEM_STATES.UNKNOWN);

    const retry = await invokeReview(storage, github, client, reviewPayload());
    assert.equal(retry.status, 409);
    assert.equal(retry.body?.error, 'BLOCKED_RECONCILIATION_REQUIRED');
    assert.equal(client.state.calls, 1);
    assert.equal(github.calls.addIssueComment, 1);
  });

  it('releases the run reservation after a deterministic pre-model GitHub failure', async () => {
    const storage = new MockStorage();
    const badGithub = reviewGithub({ throwInitial: true });
    const client = reviewClient(storage);
    const first = await invokeReview(storage, badGithub, client, reviewPayload());
    assert.equal(first.status, 409);
    assert.equal(first.body?.code, 'HEAD_READ_FAILED');
    assert.equal(client.state.calls, 0);
    assert.equal((await storage.get('run:review-run'))?.review_grok, false);

    const goodGithub = reviewGithub();
    const second = await invokeReview(
      storage,
      goodGithub,
      client,
      reviewPayload({ key: 'review-key-2', hash: 'review-hash-2' }),
    );
    assert.equal(second.status, 200);
    assert.equal(client.state.calls, 1);
  });

  it('consumes the run after a model failure so a new key cannot repeat the call', async () => {
    const storage = new MockStorage();
    const github = reviewGithub();
    const client = reviewClient(storage, { fail: true });
    const first = await invokeReview(storage, github, client, reviewPayload());
    assert.equal(first.status, 409);
    assert.equal(first.body?.code, 'REVIEW_API_FAILED');
    const githubCallsAfterFirst = { ...github.calls };

    const replay = await invokeReview(storage, github, client, reviewPayload());
    assert.equal(replay.status, first.status);
    assert.deepEqual(replay.body, first.body);
    assert.equal(replay.replay, true);
    assert.equal(client.state.calls, 1);
    assert.deepEqual(github.calls, githubCallsAfterFirst);

    const second = await invokeReview(storage, github, client, reviewPayload({ key: 'review-key-2', hash: 'review-hash-2' }));
    assert.equal(second.status, 429);
    assert.equal(client.state.calls, 1);
  });
});
