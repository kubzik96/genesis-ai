import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact, auditEvent } from '../src/audit.js';

describe('audit redact', () => {
  it('redacts token-like fields', () => {
    const out = redact({
      Authorization: 'Bearer abc',
      GITHUB_PAT: 'ghp_xxx',
      path: 'bridge/QUEUE.md',
      nested: { secret: 'x', ok: 1 },
    });
    assert.equal(out.Authorization, '[REDACTED]');
    assert.equal(out.GITHUB_PAT, '[REDACTED]');
    assert.equal(out.nested.secret, '[REDACTED]');
    assert.equal(out.nested.ok, 1);
    assert.equal(out.path, 'bridge/QUEUE.md');
  });

  it('auditEvent output contains no PAT, Authorization or service token values', () => {
    const event = auditEvent({
      endpoint: '/v1/issues',
      run_id: 'r1',
      gate: 'G1',
      idempotency_key: 'k1',
      issue_number: 7,
      github_status: 201,
      latency_ms: 12,
      outcome: 200,
      idempotency_state: 'SUCCEEDED',
      Authorization: 'Bearer secret-token',
      GITHUB_PAT: 'ghp_should_never_appear',
      BROKER_SERVICE_TOKEN: 'svc-token',
    });
    assert.equal(event.Authorization, '[REDACTED]');
    assert.equal(event.GITHUB_PAT, '[REDACTED]');
    assert.equal(event.BROKER_SERVICE_TOKEN, '[REDACTED]');
    assert.equal(event.github_status, 201);
    assert.equal(event.latency_ms, 12);
    assert.equal(event.idempotency_state, 'SUCCEEDED');
    assert.equal(event.issue_number, 7);
    assert.ok(event.timestamp);

    const serialized = JSON.stringify(event);
    assert.equal(serialized.includes('ghp_should_never_appear'), false);
    assert.equal(serialized.includes('secret-token'), false);
    assert.equal(serialized.includes('svc-token'), false);
  });
});
