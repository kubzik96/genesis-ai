/**
 * Cloudflare Durable Object class (SQLite-backed via DO storage).
 * Authoritative idempotency + rate/run state for kubzik96/genesis-ai.
 * Workers KV is NOT used (S-0002).
 *
 * All write operations are serialized through this single DO instance,
 * identified by idFromName('kubzik96/genesis-ai').
 *
 * In CODE_ONLY stage this module is source for deployment later;
 * unit tests use MemoryBrokerStore instead of the real DO runtime.
 */
import { MemoryBrokerStore } from './memory-store.js';
import { createGithubClient, mapGithubError } from './github-client.js';
import { FIXED_FULL_NAME } from './constants.js';

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
    const { idempotencyKey, requestHash, operation, runId, gate, operationData } = await request.json();

    const github = createGithubClient({ pat: this.env?.GITHUB_PAT });
    if (!github) {
      return new Response(
        JSON.stringify({
          status: 503,
          body: { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT not available in Durable Object' },
          githubCalled: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const githubCall = buildGithubCall(operation, operationData, github);
    const result = await this.store.executeWrite({
      idempotencyKey,
      requestHash,
      operation,
      runId,
      gate,
      operationData,
      githubCall,
    });
    await this.persist();
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * Build a githubCall closure for the given operation and data.
 * Called inside the Durable Object so the GitHub PAT never leaves the DO.
 */
function buildGithubCall(operation, operationData, github) {
  if (operation === 'create_issue') {
    return async () => {
      const res = await github.createIssue({
        title: operationData?.title,
        body: operationData?.body,
        labels: operationData?.labels,
      });
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        safeResult: {
          issue_number: res.data.number,
          number: res.data.number,
          html_url: res.data.html_url,
          title: res.data.title,
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  if (operation === 'assign_copilot') {
    return async () => {
      const res = await github.assignCopilot(operationData?.issueNumber);
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        safeResult: {
          issue_number: operationData?.issueNumber,
          assigned: (res.data?.assignees || []).map((a) => a.login),
          repository: FIXED_FULL_NAME,
        },
      };
    };
  }
  return async () => ({
    ok: false,
    status: 400,
    safeResult: { error: 'UNKNOWN_OPERATION', message: `Unknown operation: ${operation}` },
  });
}

