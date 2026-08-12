/**
 * In-memory / DO-backed store adapter used by the Worker.
 * Abstracts Durable Object calls for tests (mockable).
 */

import { OP_GROK_DRAFT_PR, RUN_BOUNDS } from './constants.js';

/**
 * @param {object} env - Worker env with GENESIS_STORE binding
 */
export function createMemoryStore(env) {
  const stub = env?.GENESIS_STORE;

  async function doFetch(path, body) {
    if (!stub) {
      throw new Error('GENESIS_STORE binding missing');
    }
    const id = stub.idFromName('default');
    const obj = stub.get(id);
    const res = await obj.fetch(`https://do${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`store ${path} failed: ${res.status} ${t}`);
    }
    return res.json();
  }

  return {
    async getIdempotency(requestHash) {
      return doFetch('/idempotency/get', { requestHash });
    },

    async putIdempotency(requestHash, response) {
      return doFetch('/idempotency/put', { requestHash, response });
    },

    async checkRunBounds(runId, operation) {
      return doFetch('/run-bounds/check', { runId, operation });
    },

    async incrementRunBounds(runId, operation) {
      return doFetch('/run-bounds/increment', { runId, operation });
    },

    async audit(eventType, runId, payload) {
      return doFetch('/audit', { eventType, runId, payload });
    },
  };
}

/** Pure in-memory store for unit tests (no DO). */
export function createInMemoryStore() {
  const idem = new Map();
  const counts = new Map();
  const auditLog = [];

  return {
    async getIdempotency(requestHash) {
      const v = idem.get(requestHash);
      return { hit: !!v, response: v || null };
    },
    async putIdempotency(requestHash, response) {
      idem.set(requestHash, response);
      return { ok: true };
    },
    async checkRunBounds(runId, operation) {
      const key = `${runId}:${operation}`;
      const count = counts.get(key) || 0;
      const max = RUN_BOUNDS[operation]?.maxPerRun ?? 0;
      return { allowed: count < max, count, max };
    },
    async incrementRunBounds(runId, operation) {
      const key = `${runId}:${operation}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return { ok: true };
    },
    async audit(eventType, runId, payload) {
      auditLog.push({ eventType, runId, payload, ts: Date.now() });
      return { ok: true };
    },
    _auditLog: auditLog,
    _counts: counts,
    _idem: idem,
  };
}
