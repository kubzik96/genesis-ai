import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIdempotency } from '../src/idempotency.js';
import { IDEM_STATES } from '../src/constants.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { MAX_WRITES_PER_HOUR } from '../src/constants.js';

describe('idempotency pure logic', () => {
  it('reserves pending for new key', () => {
    const d = evaluateIdempotency(null, 'hash-a');
    assert.equal(d.action, 'RESERVE_PENDING');
  });

  it('conflicts on same key different hash', () => {
    const d = evaluateIdempotency(
      { request_hash: 'hash-a', state: IDEM_STATES.SUCCEEDED, safe_result: { ok: true } },
      'hash-b',
    );
    assert.equal(d.action, 'CONFLICT');
    assert.equal(d.status, 409);
  });

  it('replays same key same hash', () => {
    const d = evaluateIdempotency(
      { request_hash: 'hash-a', state: IDEM_STATES.SUCCEEDED, safe_result: { issue_number: 1 } },
      'hash-a',
    );
    assert.equal(d.action, 'REPLAY');
    assert.equal(d.result.issue_number, 1);
  });

  it('blocks UNKNOWN without auto-retry', () => {
    const d = evaluateIdempotency(
      { request_hash: 'hash-a', state: IDEM_STATES.UNKNOWN, safe_result: {} },
      'hash-a',
    );
    assert.equal(d.action, 'BLOCKED');
    assert.equal(d.error, 'BLOCKED_RECONCILIATION_REQUIRED');
  });
});

describe('MemoryBrokerStore executeWrite', () => {
  it('calls github once then replays', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const first = await store.executeWrite({
      idempotencyKey: 'k1',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r1',
      gate: 'G1',
      githubCall: async () => {
        calls += 1;
        return { ok: true, status: 200, safeResult: { issue_number: 42 } };
      },
    });
    assert.equal(first.status, 200);
    assert.equal(first.githubCalled, true);
    assert.equal(calls, 1);

    const second = await store.executeWrite({
      idempotencyKey: 'k1',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r1',
      gate: 'G1',
      githubCall: async () => {
        calls += 1;
        return { ok: true, status: 200, safeResult: { issue_number: 99 } };
      },
    });
    assert.equal(second.githubCalled, false);
    assert.equal(second.body.issue_number, 42);
    assert.equal(calls, 1);
  });

  it('returns 409 on conflict hash', async () => {
    const store = new MemoryBrokerStore();
    await store.executeWrite({
      idempotencyKey: 'k2',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r2',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 1 } }),
    });
    const conflict = await store.executeWrite({
      idempotencyKey: 'k2',
      requestHash: 'h2',
      operation: 'create_issue',
      runId: 'r2',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 2 } }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error, 'IDEMPOTENCY_CONFLICT');
    assert.equal(conflict.githubCalled, false);
  });

  it('marks UNKNOWN on throw and forbids auto-retry', async () => {
    const store = new MemoryBrokerStore();
    const first = await store.executeWrite({
      idempotencyKey: 'k3',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r3',
      gate: 'G1',
      githubCall: async () => {
        throw new Error('timeout');
      },
    });
    assert.equal(first.unknown, true);
    assert.equal(first.body.error, 'BLOCKED_RECONCILIATION_REQUIRED');

    const retry = await store.executeWrite({
      idempotencyKey: 'k3',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r3',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 1 } }),
    });
    assert.equal(retry.githubCalled, false);
    assert.equal(retry.body.error, 'BLOCKED_RECONCILIATION_REQUIRED');
  });

  it('rate limits second create in same run_id', async () => {
    const store = new MemoryBrokerStore();
    await store.executeWrite({
      idempotencyKey: 'k4',
      requestHash: 'h1',
      operation: 'create_issue',
      runId: 'r4',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 7 } }),
    });
    const second = await store.executeWrite({
      idempotencyKey: 'k5',
      requestHash: 'h2',
      operation: 'create_issue',
      runId: 'r4',
      gate: 'G1',
      githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: 8 } }),
    });
    assert.equal(second.status, 429);
    assert.equal(second.githubCalled, false);
  });

  it('concurrent writes with same idempotency key serialize: only one GitHub call', async () => {
    const store = new MemoryBrokerStore();
    let calls = 0;
    const params = {
      idempotencyKey: 'k-concurrent',
      requestHash: 'h-concurrent',
      operation: 'create_issue',
      runId: 'r-concurrent',
      gate: 'G1',
      githubCall: async () => {
        calls += 1;
        // Small yield to allow the second Promise.all leg to enqueue.
        await new Promise((r) => setTimeout(r, 5));
        return { ok: true, status: 200, safeResult: { issue_number: 55 } };
      },
    };

    const [r1, r2] = await Promise.all([store.executeWrite(params), store.executeWrite(params)]);

    assert.equal(calls, 1, 'GitHub must be called exactly once');
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.body.issue_number, 55);
    assert.equal(r2.body.issue_number, 55);
  });

  it(`hourly rate limit: ${MAX_WRITES_PER_HOUR} writes then next is 429, no GitHub call`, async () => {
    const store = new MemoryBrokerStore();
    for (let i = 0; i < MAX_WRITES_PER_HOUR; i++) {
      const r = await store.executeWrite({
        idempotencyKey: `k-rl-${i}`,
        requestHash: `h-rl-${i}`,
        operation: 'create_issue',
        runId: `r-rl-${i}`,
        gate: 'G1',
        githubCall: async () => ({ ok: true, status: 200, safeResult: { issue_number: i + 1 } }),
      });
      assert.equal(r.status, 200, `write ${i} should succeed`);
    }
    let extraGithubCalled = false;
    const limited = await store.executeWrite({
      idempotencyKey: `k-rl-${MAX_WRITES_PER_HOUR}`,
      requestHash: `h-rl-${MAX_WRITES_PER_HOUR}`,
      operation: 'create_issue',
      runId: `r-rl-${MAX_WRITES_PER_HOUR}`,
      gate: 'G1',
      githubCall: async () => {
        extraGithubCalled = true;
        return { ok: true, status: 200, safeResult: { issue_number: 999 } };
      },
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error, 'RATE_LIMITED');
    assert.equal(limited.githubCalled, false);
    assert.equal(extraGithubCalled, false, 'GitHub must not be called when rate limited');
  });

  it('GitHub 5xx returns UNKNOWN + BLOCKED_RECONCILIATION_REQUIRED, auto-retry forbidden', async () => {
    const store = new MemoryBrokerStore();
    let githubCalls = 0;
    const first = await store.executeWrite({
      idempotencyKey: 'k-5xx',
      requestHash: 'h-5xx',
      operation: 'create_issue',
      runId: 'r-5xx',
      gate: 'G1',
      githubCall: async () => {
        githubCalls += 1;
        return { ok: false, status: 500, safeResult: { error: 'GITHUB_500', message: 'GitHub upstream error' } };
      },
    });
    assert.equal(first.unknown, true);
    assert.equal(first.body.error, 'BLOCKED_RECONCILIATION_REQUIRED');
    assert.equal(first.githubCalled, true);
    assert.equal(githubCalls, 1);

    // Retry with same key must be blocked — no second GitHub call.
    const retry = await store.executeWrite({
      idempotencyKey: 'k-5xx',
      requestHash: 'h-5xx',
      operation: 'create_issue',
      runId: 'r-5xx',
      gate: 'G1',
      githubCall: async () => {
        githubCalls += 1;
        return { ok: true, status: 200, safeResult: { issue_number: 1 } };
      },
    });
    assert.equal(retry.githubCalled, false);
    assert.equal(retry.body.error, 'BLOCKED_RECONCILIATION_REQUIRED');
    assert.equal(githubCalls, 1, 'GitHub must not be called on retry after UNKNOWN');
  });

  it('happy-path: create_issue then assign same run_id succeeds; foreign issue returns 403', async () => {
    const store = new MemoryBrokerStore();
    let createCalls = 0;
    let assignCalls = 0;

    // Step 1: create issue 42.
    const create = await store.executeWrite({
      idempotencyKey: 'k-hp-create',
      requestHash: 'h-hp-create',
      operation: 'create_issue',
      runId: 'r-hp',
      gate: 'G1',
      githubCall: async () => {
        createCalls += 1;
        return { ok: true, status: 200, safeResult: { issue_number: 42, number: 42 } };
      },
    });
    assert.equal(create.status, 200);
    assert.equal(create.body.issue_number, 42);
    assert.equal(createCalls, 1);

    // Step 2: attempt to assign a foreign issue (99) - expect 403, no GitHub call.
    const foreign = await store.executeWrite({
      idempotencyKey: 'k-hp-foreign',
      requestHash: 'h-hp-foreign',
      operation: 'assign_copilot',
      runId: 'r-hp',
      gate: 'G2',
      operationData: { issueNumber: 99 },
      githubCall: async () => {
        assignCalls += 1;
        return { ok: true, status: 200, safeResult: { issue_number: 99 } };
      },
    });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.body.error, 'ISSUE_NOT_FROM_RUN');
    assert.equal(foreign.githubCalled, false);
    assert.equal(assignCalls, 0, 'GitHub must not be called for foreign issue');

    // Step 3: assign the correct issue (42) - expect 200.
    const assign = await store.executeWrite({
      idempotencyKey: 'k-hp-assign',
      requestHash: 'h-hp-assign',
      operation: 'assign_copilot',
      runId: 'r-hp',
      gate: 'G2',
      operationData: { issueNumber: 42 },
      githubCall: async () => {
        assignCalls += 1;
        return {
          ok: true,
          status: 200,
          safeResult: { issue_number: 42, assigned: ['copilot-swe-agent[bot]'] },
        };
      },
    });
    assert.equal(assign.status, 200);
    assert.equal(assign.body.issue_number, 42);
    assert.equal(assignCalls, 1);
  });
});
