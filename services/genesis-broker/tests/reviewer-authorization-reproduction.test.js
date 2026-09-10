import { it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { BrokerDurableObject } from '../src/index.js';

// Issue #116 / F2 characterization ONLY. Passing tests below reproduce unsafe
// current behavior; they do not establish the one-call-per-authorization invariant.
// A separately authorized F2 fix must replace the two-dispatch expectations with
// that invariant. No production source, schema, or authorization decision here.
// All transport and storage boundaries are offline fakes; no real credentials.
const HEAD = 'a'.repeat(40);
const AUTHORIZATION = Object.freeze({
  repository: 'kubzik96/genesis-ai', prNumber: 112, expectedHeadSha: HEAD,
  reviewPurpose: 'Offline F2 characterization for Issue 116',
  criteria: Object.freeze(['One model request per issued authorization']),
  artifactProducer: 'CODEX', modelCallAuthorized: true, modelRequestLimit: 1,
  durablePersistenceAuthorized: true,
  forbiddenActions: Object.freeze(['READY', 'MERGE', 'REMEDIATION', 'DEPLOY', 'DIFY',
    'BROKER_AUTH_RUNTIME', 'CLOUDFLARE', 'SECRETS', 'QUARANTINE_REMOVAL', 'REPEAT_MODEL_CALL']),
});

function harness({ interruptFinalization = false, failReadback = false, holdFirstModel = false } = {}) {
  const state = new Map();
  const comments = new Map();
  const counts = { model: 0, persistence: 0, headReads: 0, githubCalls: 0 };
  const modelRequests = [];
  let interrupted = false;
  let signalModelStarted;
  let signalSecondForwarded;
  let forwarded = 0;
  let releaseModel;
  const modelStarted = new Promise(resolve => { signalModelStarted = resolve; });
  const modelReleased = new Promise(resolve => { releaseModel = resolve; });
  const secondForwarded = new Promise(resolve => { signalSecondForwarded = resolve; });
  const storage = {
    async get(key) { return structuredClone(state.get(key)); },
    async put(key, value) {
      const entries = typeof key === 'object' ? Object.entries(key) : [[key, value]];
      if (interruptFinalization && !interrupted && entries.some(([k, v]) => k.startsWith('idem:') && v.state === 'SUCCEEDED')) {
        interrupted = true;
        throw new Error('Offline fault before atomic finalization');
      }
      // Atomic batch fake. This does not simulate Cloudflare process/storage durability.
      for (const [k, v] of entries) state.set(k, structuredClone(v));
    },
  };
  const github = {
    async getPull(number) {
      assert.equal(number, 112); counts.headReads++; counts.githubCalls++;
      return { ok: true, status: 200, data: { head: { sha: HEAD } } };
    },
    async getPullFiles() {
      counts.githubCalls++;
      return { ok: true, status: 200, headers: new Headers(), data: [{ filename: 'docs/audit.md', status: 'added' }] };
    },
    async getPullDiff() {
      counts.githubCalls++;
      return { ok: true, status: 200, data: 'diff --git a/docs/audit.md b/docs/audit.md\n+offline fixture' };
    },
    async addIssueComment(number, body) {
      assert.equal(number, 112); counts.persistence++; counts.githubCalls++;
      comments.set(counts.persistence, body);
      return { ok: true, status: 201, data: { id: counts.persistence } };
    },
    async getIssueComment(id) {
      counts.githubCalls++;
      if (failReadback) return { ok: false, status: 503 };
      return { ok: true, status: 200, data: {
        issue_url: 'https://api.github.com/repos/kubzik96/genesis-ai/issues/112', body: comments.get(id),
      } };
    },
  };
  const env = {
    BROKER_SERVICE_TOKEN: 'offline-service-fixture', GITHUB_PAT: 'offline-github-fixture',
    XAI_API_KEY: 'offline-model-fixture', XAI_REVIEWER_LIVE_ENABLED: 'true',
    _github: github,
    async _xaiFetchImpl(url, options) {
      assert.equal(url, 'https://api.x.ai/v1/chat/completions');
      assert.equal(options.method, 'POST'); counts.model++;
      modelRequests.push(JSON.parse(options.body));
      signalModelStarted();
      if (holdFirstModel && counts.model === 1) await modelReleased;
      const review = { verdict: 'APPROVE', reviewed_head_sha: HEAD,
        head_confirmed: 'YES', scope: 'CLEAN', findings: [], ready_gate_safe: 'YES' };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(review) } }] }));
    },
    async _fetchImpl() { throw new Error('Unexpected network boundary'); },
  };
  let object = new BrokerDurableObject({ storage }, env);
  env.BROKER_DO = {
    idFromName(name) { assert.equal(name, 'kubzik96/genesis-ai'); return name; },
    get() { return { fetch(url, options) {
      const response = object.fetch(new Request(url, options));
      if (++forwarded === 2) signalSecondForwarded();
      return response;
    } }; },
  };
  return {
    counts, state, comments, modelRequests, modelStarted, secondForwarded, releaseModel,
    reconstruct() { object = new BrokerDurableObject({ storage }, env); },
    async post(runId, key) {
      const response = await worker.fetch(new Request('https://broker.invalid/v1/reviews/grok', {
        method: 'POST',
        headers: { authorization: 'Bearer offline-service-fixture', 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify({ authorization: AUTHORIZATION, context: 'Bounded offline canonical audit context', run_id: runId }),
      }), env);
      return { status: response.status, body: await response.json() };
    },
  };
}

it('F2 control: same identifiers replay after reconstruction with a fresh HEAD read and one dispatch', async () => {
  const h = harness();
  const first = await h.post('audit-a', 'audit-key-a');
  assert.equal(first.status, 200);
  assert.equal(first.body.consequential_gate_evidence_available, true);
  const reads = h.counts.headReads;
  h.reconstruct();
  const replay = await h.post('audit-a', 'audit-key-a');
  assert.deepEqual(replay, first);
  assert.equal(h.counts.headReads, reads + 1);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

it('F2 control: a new run_id with the same idempotency key conflicts without another dispatch', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-a')).status, 409);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

it('F2 control: a new idempotency key with the same run_id cannot dispatch twice', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  const before = { ...h.counts };
  h.reconstruct();
  const blocked = await h.post('audit-a', 'audit-key-b');
  // This run completed successfully: its terminal bound is RATE_LIMITED.
  // An active PENDING reservation has a different contract, exercised below.
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
  assert.deepEqual(h.counts, before, 'a completed run rejects a new key without external calls');
});

it('F2 KNOWN DEFECT: unchanged authorization with new run_id and key dispatches twice after reconstruction', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  h.reconstruct();
  const second = await h.post('audit-b', 'audit-key-b');
  assert.equal(second.status, 200);
  assert.equal(second.body.consequential_gate_evidence_available, true);
  assert.equal(h.counts.model, 2, 'Characterizes F2; required safety invariant is at most one');
  assert.equal(h.counts.persistence, 2);
  assert.deepEqual(h.modelRequests[0], h.modelRequests[1]);
  assert.equal(h.comments.get(1), h.comments.get(2), 'V1 evidence cannot distinguish these two executions');
});

it('F2 KNOWN DEFECT: overlapping different runs on one DO still consume the same authorization twice', { timeout: 5000 }, async (t) => {
  const h = harness({ holdFirstModel: true });
  t.after(() => h.releaseModel());
  const first = h.post('audit-a', 'audit-key-a');
  await h.modelStarted;
  const second = h.post('audit-b', 'audit-key-b');
  await h.secondForwarded;
  h.releaseModel();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 200]);
  assert.equal(h.counts.model, 2);
  assert.equal(h.counts.persistence, 2);
});

it('F2 control: overlapping requests within one run consume one call', { timeout: 5000 }, async (t) => {
  const h = harness({ holdFirstModel: true });
  t.after(() => h.releaseModel());
  const first = h.post('audit-a', 'audit-key-a');
  await h.modelStarted;
  const second = h.post('audit-a', 'audit-key-b');
  await h.secondForwarded;
  h.releaseModel();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 429]);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

it('recovery gap: evidence exists after failed finalization but same identifiers remain PENDING and blocked', async () => {
  const h = harness({ interruptFinalization: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 503);
  assert.equal(h.comments.size, 1);
  assert.equal(h.state.get('idem:audit-key-a').state, 'PENDING');
  const before = { ...h.counts };
  h.reconstruct();
  const recovery = await h.post('audit-a', 'audit-key-a');
  assert.equal(recovery.status, 409);
  assert.equal(recovery.body.error, 'IDEMPOTENCY_IN_FLIGHT');
  assert.equal(h.state.get('idem:audit-key-a').state, 'PENDING');
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  const newKey = await h.post('audit-a', 'audit-key-b');
  assert.equal(newKey.status, 409);
  assert.equal(newKey.body.error, 'BLOCKED_RECONCILIATION_REQUIRED');
  assert.deepEqual(h.counts, before, 'PENDING blocks both original and new keys without any GitHub/model call');
});

it('F2 KNOWN DEFECT: new identifiers bypass a previous PENDING run after evidence was written', async () => {
  const h = harness({ interruptFinalization: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 503);
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 200);
  assert.equal(h.state.get('idem:audit-key-a').state, 'PENDING');
  assert.equal(h.counts.model, 2);
  assert.equal(h.counts.persistence, 2);
});

it('F2 KNOWN DEFECT: UNKNOWN blocks original identifiers but not the same authorization under fresh ones', async () => {
  const h = harness({ failReadback: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.state.get('idem:audit-key-a').state, 'UNKNOWN');
  h.reconstruct();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.state.get('idem:audit-key-b').state, 'UNKNOWN');
  assert.equal(h.counts.model, 2);
  assert.equal(h.counts.persistence, 2);
});
