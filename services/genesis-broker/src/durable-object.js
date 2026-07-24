/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * In CODE_ONLY stage this module is source for deployment later;
 * unit tests use MemoryBrokerStore instead of the real DO runtime.
 */
import { MemoryBrokerStore } from './memory-store.js';

export class BrokerDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.store = new MemoryBrokerStore();
    this._loaded = false;
  }

  async ensureLoaded() {
    if (this._loaded || !this.state?.storage) return;
    const snap = await this.state.storage.get('broker_snapshot');
    if (snap) {
      this.store.idem = new Map(snap.idem || []);
      this.store.writeTimestamps = snap.writeTimestamps || [];
      this.store.runs = new Map(snap.runs || []);
    }
    this._loaded = true;
  }

  async persist() {
    if (!this.state?.storage) return;
    await this.state.storage.put('broker_snapshot', {
      idem: [...this.store.idem.entries()],
      writeTimestamps: this.store.writeTimestamps,
      runs: [...this.store.runs.entries()],
    });
  }

  async fetch(request) {
    await this.ensureLoaded();
    const body = await request.json();
    const result = await this.store.executeWrite(body);
    await this.persist();
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  }
}
