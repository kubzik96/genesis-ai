/**
 * Durable Object — authoritative SQLite store for idempotency, run bounds, audit.
 * Fail-closed on any storage error.
 */

import { OP_GROK_DRAFT_PR, RUN_BOUNDS } from './constants.js';

export class GenesisStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.#initSchema();
  }

  #initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS idempotency (
        request_hash TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS run_counts (
        run_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (run_id, operation)
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        run_id TEXT,
        payload_json TEXT NOT NULL
      );
    `);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/idempotency/get' && request.method === 'POST') {
        const { requestHash } = await request.json();
        const row = this.sql.exec(
          'SELECT response_json FROM idempotency WHERE request_hash = ?',
          requestHash
        ).toArray()[0];
        return Response.json({ hit: !!row, response: row ? JSON.parse(row.response_json) : null });
      }

      if (path === '/idempotency/put' && request.method === 'POST') {
        const { requestHash, response } = await request.json();
        this.sql.exec(
          'INSERT OR REPLACE INTO idempotency (request_hash, response_json, created_at) VALUES (?, ?, ?)',
          requestHash,
          JSON.stringify(response),
          Date.now()
        );
        return Response.json({ ok: true });
      }

      if (path === '/run-bounds/check' && request.method === 'POST') {
        const { runId, operation } = await request.json();
        const max = RUN_BOUNDS[operation]?.maxPerRun ?? 0;
        const row = this.sql.exec(
          'SELECT count FROM run_counts WHERE run_id = ? AND operation = ?',
          runId,
          operation
        ).toArray()[0];
        const count = row ? row.count : 0;
        return Response.json({ allowed: count < max, count, max });
      }

      if (path === '/run-bounds/increment' && request.method === 'POST') {
        const { runId, operation } = await request.json();
        this.sql.exec(
          `INSERT INTO run_counts (run_id, operation, count) VALUES (?, ?, 1)
           ON CONFLICT(run_id, operation) DO UPDATE SET count = count + 1`,
          runId,
          operation
        );
        return Response.json({ ok: true });
      }

      if (path === '/audit' && request.method === 'POST') {
        const { eventType, runId, payload } = await request.json();
        // Never store secrets
        const safe = { ...payload };
        delete safe.token;
        delete safe.pat;
        delete safe.apiKey;
        delete safe.authorization;
        this.sql.exec(
          'INSERT INTO audit_events (ts, event_type, run_id, payload_json) VALUES (?, ?, ?, ?)',
          Date.now(),
          eventType,
          runId || null,
          JSON.stringify(safe)
        );
        return Response.json({ ok: true });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return Response.json({ error: 'store_error', message: String(err?.message || err) }, { status: 500 });
    }
  }
}
