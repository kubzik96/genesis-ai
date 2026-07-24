import { IDEM_STATES } from './constants.js';

/**
 * Pure idempotency decision logic (S-0002 §4.5).
 * Durable Object applies this atomically with SQLite storage.
 */
export function evaluateIdempotency(existing, requestHash) {
  if (!existing) {
    return { action: 'RESERVE_PENDING' };
  }
  if (existing.request_hash !== requestHash) {
    return {
      action: 'CONFLICT',
      status: 409,
      error: 'IDEMPOTENCY_CONFLICT',
      message: 'Same Idempotency-Key with different request payload',
    };
  }
  if (existing.state === IDEM_STATES.PENDING) {
    return {
      action: 'IN_FLIGHT',
      status: 409,
      error: 'IDEMPOTENCY_IN_FLIGHT',
      message: 'Write already in progress for this key',
    };
  }
  if (existing.state === IDEM_STATES.SUCCEEDED || existing.state === IDEM_STATES.FAILED) {
    return { action: 'REPLAY', result: existing.safe_result, state: existing.state };
  }
  if (existing.state === IDEM_STATES.UNKNOWN) {
    return {
      action: 'BLOCKED',
      status: 409,
      error: 'BLOCKED_RECONCILIATION_REQUIRED',
      message: 'Prior write left UNKNOWN; auto-retry forbidden — reconcile via read-only status first',
    };
  }
  return {
    action: 'BLOCKED',
    status: 500,
    error: 'INVALID_IDEM_STATE',
    message: `Unknown idempotency state: ${existing.state}`,
  };
}

export function markSucceeded(record, safeResult) {
  return { ...record, state: IDEM_STATES.SUCCEEDED, safe_result: safeResult };
}

export function markFailed(record, safeResult) {
  return { ...record, state: IDEM_STATES.FAILED, safe_result: safeResult };
}

export function markUnknown(record, safeResult) {
  return { ...record, state: IDEM_STATES.UNKNOWN, safe_result: safeResult };
}

export function isDeterministicClientError(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
