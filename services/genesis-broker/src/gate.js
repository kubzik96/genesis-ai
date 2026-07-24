import { GATE_TTL_MINUTES, GATES } from './constants.js';

/**
 * Validate CEO Gate payload fields for write operations.
 * Broker cannot cryptographically prove CEO pressed the button (S-0002).
 */
export function validateGate({ gate, expectedGate, confirmed_at, run_id, now = new Date() }) {
  if (!run_id || typeof run_id !== 'string' || !run_id.trim()) {
    return { ok: false, status: 400, error: 'INVALID_RUN_ID', message: 'run_id is required' };
  }
  if (gate !== expectedGate) {
    return {
      ok: false,
      status: 400,
      error: 'GATE_MISMATCH',
      message: `Expected gate ${expectedGate}, got ${gate}`,
    };
  }
  if (!Object.values(GATES).includes(gate)) {
    return { ok: false, status: 400, error: 'INVALID_GATE', message: 'Unknown gate' };
  }
  if (!confirmed_at || typeof confirmed_at !== 'string') {
    return { ok: false, status: 400, error: 'MISSING_CONFIRMED_AT', message: 'confirmed_at is required' };
  }
  const confirmed = new Date(confirmed_at);
  if (Number.isNaN(confirmed.getTime())) {
    return { ok: false, status: 400, error: 'INVALID_CONFIRMED_AT', message: 'confirmed_at must be ISO-8601' };
  }
  const ageMs = now.getTime() - confirmed.getTime();
  const ttlMs = GATE_TTL_MINUTES * 60 * 1000;
  if (ageMs < -60_000) {
    return { ok: false, status: 400, error: 'GATE_IN_FUTURE', message: 'confirmed_at is in the future' };
  }
  if (ageMs > ttlMs) {
    return {
      ok: false,
      status: 403,
      error: 'GATE_EXPIRED',
      message: `Gate TTL exceeded (${GATE_TTL_MINUTES} minutes)`,
    };
  }
  return { ok: true };
}
