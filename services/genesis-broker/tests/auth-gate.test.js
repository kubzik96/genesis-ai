import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateService } from '../src/auth.js';
import { validateGate } from '../src/gate.js';
import { GATES } from '../src/constants.js';

describe('auth', () => {
  it('rejects missing token', () => {
    const r = authenticateService(null, 'secret');
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
  });

  it('accepts valid bearer', () => {
    const r = authenticateService('Bearer secret', 'secret');
    assert.equal(r.ok, true);
  });

  it('rejects wrong token', () => {
    const r = authenticateService('Bearer nope', 'secret');
    assert.equal(r.ok, false);
  });
});

describe('gate', () => {
  it('accepts fresh confirmed_at', () => {
    const r = validateGate({
      gate: GATES.CREATE_ISSUE,
      expectedGate: GATES.CREATE_ISSUE,
      confirmed_at: new Date().toISOString(),
      run_id: 'run-1',
    });
    assert.equal(r.ok, true);
  });

  it('rejects expired gate', () => {
    const old = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const r = validateGate({
      gate: GATES.CREATE_ISSUE,
      expectedGate: GATES.CREATE_ISSUE,
      confirmed_at: old,
      run_id: 'run-1',
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'GATE_EXPIRED');
  });

  it('rejects gate mismatch', () => {
    const r = validateGate({
      gate: GATES.ASSIGN_COPILOT,
      expectedGate: GATES.CREATE_ISSUE,
      confirmed_at: new Date().toISOString(),
      run_id: 'run-1',
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'GATE_MISMATCH');
  });
});
