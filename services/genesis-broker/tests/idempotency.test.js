import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIdempotency } from '../src/idempotency.js';
import { IDEM_STATES } from '../src/constants.js';
import { MemoryBrokerStore } from '../src/memory-store.js';

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
});
