/**
 * Simple rate-limit / run-bound helpers.
 */

import { RUN_BOUNDS, OP_GROK_DRAFT_PR } from './constants.js';

/**
 * @param {string} operation
 * @returns {{ maxPerRun: number }}
 */
export function getRunBound(operation) {
  return RUN_BOUNDS[operation] || { maxPerRun: 0 };
}

/**
 * Check whether an operation is still within its per-run bound.
 * @param {object} store
 * @param {string} runId
 * @param {string} operation
 */
export async function assertRunBound(store, runId, operation) {
  const { allowed, count, max } = await store.checkRunBounds(runId, operation);
  if (!allowed) {
    const err = new Error(`run bound exceeded for ${operation}: ${count}/${max}`);
    err.status = 429;
    err.code = 'run_bound_exceeded';
    throw err;
  }
  return { count, max };
}

export { OP_GROK_DRAFT_PR };
