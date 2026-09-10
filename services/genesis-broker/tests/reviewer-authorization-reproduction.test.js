import { createHash } from 'node:crypto';
import { requestHash } from '../src/hash.js';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { BrokerDurableObject } from '../src/index.js';

// S-0010 Revision 2 normative invariants, rebuilt from PR #117 characterization.
// Offline Worker -> hash -> DO proxy -> durable ledger -> real xAI adapter with fake fetch.
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

const sha256 = text => createHash('sha256').update(text).digest('hex');
function issuedGrant(id = 9001, manifest = AUTHORIZATION) {
  const body = 'GENESIS_REVIEW_GRANT_V1 ' + JSON.stringify(manifest);
  const canonical = Object.fromEntries(Object.keys(manifest).sort().map(key => [key,
    key === 'forbiddenActions' ? [...new Set(manifest[key])].sort() : manifest[key]]));
  return { authorization: { ...manifest, grantId: 'github:issue-comment:' + id,
    manifestHash: sha256(JSON.stringify(canonical)), issuanceDigest: sha256(body) },
    receipt: { id, body, user: { id: 307621171, login: 'kubzik96', type: 'User' },
      issue_url: 'https://api.github.com/repos/kubzik96/genesis-ai/issues/116',
      created_at: '2026-09-10T00:00:00Z', updated_at: '2026-09-10T00:00:00Z' } };
}
const GRANT = issuedGrant();
const GRANT_KEY = 'review:grant:' + GRANT.authorization.grantId;

function harness({ interruptFinalization = false, failReadback = false, holdFirstModel = false, providerFailure = null, failReservation = false, failConsumption = false, mutateAfterAdmission = false } = {}) {
  const state = new Map();
  const grants = new Map([[9001, structuredClone(GRANT.receipt)]]);
  let currentHead = HEAD;
  let headFailure = false;
  const transitions = [];
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
      transitions.push(structuredClone(entries));
      if (failReservation && entries.some(([k,v]) => k === GRANT_KEY && v.state === 'RESERVED')) throw new Error('reservation failure');
      if (failConsumption && entries.some(([k,v]) => k === GRANT_KEY && v.state === 'CONSUMED')) throw new Error('consumption failure');
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
      assert.equal(number, 112); counts.headReads++;
      if (mutateAfterAdmission) grants.get(9001).updated_at = '2026-09-10T00:00:01Z'; counts.githubCalls++;
      if (headFailure) throw new Error('head unavailable');
      return { ok: true, status: 200, data: { head: { sha: currentHead } } };
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
      if (grants.has(id)) return { ok: true, status: 200, data: structuredClone(grants.get(id)) };
      if (failReadback) return { ok: false, status: 503 };
      return { ok: true, status: 200, data: {
        id, issue_url: 'https://api.github.com/repos/kubzik96/genesis-ai/issues/112', body: comments.get(id),
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
      assert.equal(state.get(GRANT_KEY)?.state === 'CONSUMED' || [...state.values()].some(v =>
        v?.state === 'CONSUMED' && v?.operation === 'review_grok'), true, 'durable consumption precedes provider dispatch');
      modelRequests.push(JSON.parse(options.body));
      if (providerFailure === 'throw' || providerFailure === 'timeout') throw new Error(providerFailure);
      if (providerFailure === 'malformed') return new Response('invalid-json');
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
    counts, state, comments, grants, transitions, modelRequests, modelStarted, secondForwarded, releaseModel,
    setHead(sha) { currentHead = sha; },
    failHead() { headFailure = true; },
    reconstruct() { object = new BrokerDurableObject({ storage }, env); },
    async post(runId, key, authorization = GRANT.authorization) {
      const response = await worker.fetch(new Request('https://broker.invalid/v1/reviews/grok', {
        method: 'POST',
        headers: { authorization: 'Bearer offline-service-fixture', 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify({ authorization, context: 'Bounded offline canonical audit context', run_id: runId }),
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
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, 'REVIEW_GRANT_CLOSED');
  assert.deepEqual(h.counts, before, 'a completed run rejects a new key without external calls');
});

it('F2 invariant: unchanged authorization with new run_id and key cannot dispatch twice after reconstruction', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  h.reconstruct();
  const second = await h.post('audit-b', 'audit-key-b');
  assert.equal(second.status, 409);
  assert.equal(second.body.consequential_gate_evidence_available, false);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  assert.equal(h.modelRequests.length, 1);
  assert.equal(h.comments.size, 1);
});

it('F2 invariant: overlapping different runs on one DO admit the grant only once', { timeout: 5000 }, async (t) => {
  const h = harness({ holdFirstModel: true });
  t.after(() => h.releaseModel());
  const first = h.post('audit-a', 'audit-key-a');
  await h.modelStarted;
  const second = h.post('audit-b', 'audit-key-b');
  await h.secondForwarded;
  h.releaseModel();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 409]);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

it('F2 control: overlapping requests within one run consume one call', { timeout: 5000 }, async (t) => {
  const h = harness({ holdFirstModel: true });
  t.after(() => h.releaseModel());
  const first = h.post('audit-a', 'audit-key-a');
  await h.modelStarted;
  const second = h.post('audit-a', 'audit-key-b');
  await h.secondForwarded;
  h.releaseModel();
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 409]);
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
  assert.equal(newKey.body.code, 'REVIEW_GRANT_CLOSED');
  assert.deepEqual(h.counts, before, 'PENDING blocks both original and new keys without any GitHub/model call');
});

it('F2 invariant: new identifiers cannot bypass a previous PENDING run after evidence was written', async () => {
  const h = harness({ interruptFinalization: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 503);
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.state.get('idem:audit-key-a').state, 'PENDING');
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

it('F2 invariant: UNKNOWN blocks original identifiers and the same authorization under fresh ones', async () => {
  const h = harness({ failReadback: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.state.get('idem:audit-key-a').state, 'UNKNOWN');
  h.reconstruct();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.state.has('idem:audit-key-b'), false);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
});

for (const outcome of ['throw', 'malformed', 'timeout']) {
  it('F2 provider ' + outcome + ' consumes the grant with no second dispatch', async () => {
    const h = harness({ providerFailure: outcome });
    assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
    assert.equal(h.state.get(GRANT_KEY).state, 'CONSUMED');
    h.reconstruct();
    assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
    assert.equal(h.counts.model, 1);
    assert.equal(h.counts.persistence, 0);
  });
}

it('F2 reservation is atomic with execution identities and precedes dispatch', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  const reserve = h.transitions.find(entries => entries.some(([key, value]) =>
    key === GRANT_KEY && value.state === 'RESERVED'));
  assert.deepEqual(reserve.map(([key]) => key).sort(), [GRANT_KEY, 'idem:audit-key-a', 'run:audit-a'].sort());
  assert.equal(h.state.get(GRANT_KEY).state, 'CONSUMED');
  assert.equal(h.counts.model, 1);
});

it('F2 failed reservation cannot dispatch', async () => {
  const h = harness({ failReservation: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 503);
  assert.equal(h.counts.model, 0);
  assert.equal(h.counts.persistence, 0);
});

it('F2 uncertain consumption write becomes UNKNOWN and cannot dispatch', async () => {
  const h = harness({ failConsumption: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.state.get(GRANT_KEY).state, 'UNKNOWN');
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.counts.model, 0);
});

it('F2 reconstruction from RESERVED alone never admits the grant again', async () => {
  const h = harness();
  h.state.set(GRANT_KEY, { ...GRANT.authorization, state: 'RESERVED' });
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.counts.model, 0);
  assert.equal(h.counts.githubCalls, 0);
});

it('F2 deterministic pre-model failure closes grant; corrected HEAD needs a new EA', async () => {
  const h = harness();
  h.setHead('b'.repeat(40));
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.state.get(GRANT_KEY).state, 'CLOSED_NO_CALL');
  h.setHead(HEAD);
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.counts.model, 0);
});

for (const [name, transform] of [
  ['random ID', a => ({ ...a, grantId: 'caller-random-id' })],
  ['noncanonical comment', a => ({ ...a, grantId: 'github:issue-comment:8000' })],
  ['manifest mismatch', a => ({ ...a, manifestHash: 'f'.repeat(64) })],
  ['issuance digest mismatch', a => ({ ...a, issuanceDigest: 'f'.repeat(64) })],
  ['changed purpose', a => ({ ...a, reviewPurpose: 'Another purpose' })],
  ['changed criteria', a => ({ ...a, criteria: ['Another criterion'] })],
]) {
  it('F2 rejects ' + name + ' before dispatch', async () => {
    const h = harness();
    assert.equal((await h.post('audit-a', 'audit-key-a', transform(GRANT.authorization))).status, 409);
    assert.equal(h.counts.model, 0);
    assert.equal(h.counts.persistence, 0);
    assert.equal(h.state.has(GRANT_KEY), false);
  });
}

for (const [name, transform] of [
  ['edited timestamp', r => ({ ...r, updated_at: '2026-09-10T00:00:01Z' })],
  ['body mutation', r => ({ ...r, body: r.body + ' ' })],
  ['wrong issuer', r => ({ ...r, user: { ...r.user, id: 123 } })],
  ['app-generated record', r => ({ ...r, performed_via_github_app: { id: 1 } })],
  ['wrong repository', r => ({ ...r, issue_url: 'https://api.github.com/repos/other/repo/issues/116' })],
  ['wrong receipt ID', r => ({ ...r, id: 9002 })],
  ['missing creation metadata', r => ({ ...r, created_at: undefined, updated_at: undefined })],
]) {
  it('F2 rejects canonical provenance with ' + name, async () => {
    const h = harness();
    h.grants.set(9001, transform(GRANT.receipt));
    assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
    assert.equal(h.counts.model, 0);
  });
}

it('F2 equal conditions need a genuinely separate canonical CEO issuance', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  const another = issuedGrant(9002);
  assert.equal((await h.post('audit-b', 'audit-key-b', another.authorization)).status, 409);
  assert.equal(h.counts.model, 1);
  h.grants.set(9002, another.receipt);
  assert.equal((await h.post('audit-b', 'audit-key-b', another.authorization)).status, 200);
  assert.equal(h.counts.model, 2, 'two independently issued grants, one dispatch each');
});

it('F2 reordered authorization object and forbidden set cannot mint another grant', async () => {
  const h = harness();
  const reordered = Object.fromEntries(Object.entries(GRANT.authorization).reverse());
  reordered.forbiddenActions = [...reordered.forbiddenActions].reverse();
  assert.equal((await h.post('audit-a', 'audit-key-a', reordered)).status, 200);
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
  assert.equal(h.counts.model, 1);
});

it('F2 ordered criteria are not canonicalized as an unordered set', async () => {
  const h = harness();
  const issuance = issuedGrant(9001, { ...AUTHORIZATION, criteria: ['first', 'second'] });
  h.grants.set(9001, issuance.receipt);
  const changed = { ...issuance.authorization, criteria: ['second', 'first'] };
  assert.equal((await h.post('audit-a', 'audit-key-a', changed)).status, 409);
  assert.equal(h.counts.model, 0);
});

it('F2 Evidence V2 and durable receipt bind exact grant, operation, repo and HEAD', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
  const prefix = 'GENESIS_REVIEW_EVIDENCE_V2 ';
  assert.ok(h.comments.get(1).startsWith(prefix));
  const evidence = JSON.parse(h.comments.get(1).slice(prefix.length));
  const ledger = h.state.get(GRANT_KEY);
  assert.equal(evidence.envelope_version, 2);
  assert.equal(evidence.grantId, GRANT.authorization.grantId);
  assert.equal(evidence.manifestHash, GRANT.authorization.manifestHash);
  assert.equal(evidence.request_hash, h.state.get('idem:audit-key-a').request_hash);
  assert.equal(evidence.run_id, 'audit-a');
  assert.equal(evidence.repository, AUTHORIZATION.repository);
  assert.equal(evidence.pr_number, AUTHORIZATION.prNumber);
  assert.equal(evidence.reviewed_head_sha, HEAD);
  assert.equal(ledger.evidence_receipt.comment_id, 1);
  assert.equal(ledger.evidence_receipt.read_back_verified, true);
  assert.equal(ledger.evidence_receipt.grantId, evidence.grantId);
  assert.equal(ledger.evidence_receipt.request_hash, evidence.request_hash);
});

async function seedLegacy(h, state = 'SUCCEEDED') {
  const hash = await requestHash({ op: 'review_grok', run_id: 'audit-a',
    authorization: AUTHORIZATION, context: 'Bounded offline canonical audit context' });
  const body = { ok: true, verdict: 'APPROVE', reviewed_head_sha: HEAD,
    ready_gate_safe: 'YES', consequential_gate_evidence_available: true };
  const result = state === 'FAILED'
    ? { status: 409, body: { ok: false, verdict: 'BLOCKED', ready_gate_safe: 'NO', consequential_gate_evidence_available: false } }
    : { status: 200, body };
  h.state.set('idem:audit-key-a', { idempotency_key: 'audit-key-a', request_hash: hash,
    operation: 'review_grok', run_id: 'audit-a', state, safe_result: result });
  return result;
}

it('F2 legacy request without grant cannot enter fresh execution', async () => {
  const h = harness();
  assert.equal((await h.post('audit-a', 'audit-key-a', AUTHORIZATION)).status, 409);
  assert.equal(h.counts.model, 0);
  assert.equal(h.counts.githubCalls, 0);
  assert.equal(h.state.size, 0);
});

it('F2 historical legacy replay remains immutable, model-free and verifies HEAD', async () => {
  const h = harness();
  const historical = await seedLegacy(h);
  const before = structuredClone([...h.state]);
  assert.deepEqual(await h.post('audit-a', 'audit-key-a', AUTHORIZATION), historical);
  assert.equal(h.counts.headReads, 1);
  assert.equal(h.counts.model, 0);
  assert.equal(h.counts.persistence, 0);
  assert.deepEqual([...h.state], before);
});

for (const state of ['PENDING', 'UNKNOWN', 'FAILED']) {
  it('F2 legacy ' + state + ' cannot become fresh authority', async () => {
    const h = harness();
    await seedLegacy(h, state);
    assert.equal((await h.post('audit-a', 'audit-key-a', AUTHORIZATION)).status, 409);
    assert.equal((await h.post('audit-b', 'audit-key-b', AUTHORIZATION)).status, 409);
    assert.equal(h.counts.model, 0);
    assert.equal(h.counts.githubCalls, 0);
  });
}

it('F2 legacy request hash conflict remains blocked', async () => {
  const h = harness();
  await seedLegacy(h);
  assert.equal((await h.post('audit-b', 'audit-key-a', AUTHORIZATION)).status, 409);
  assert.equal(h.counts.model, 0);
  assert.equal(h.counts.githubCalls, 0);
});

for (const legacy of [false, true]) {
  for (const failure of ['changed', 'unavailable']) {
    it('F1 replay freshness with legacy=' + legacy + ', HEAD=' + failure, async () => {
      const h = harness();
      const auth = legacy ? AUTHORIZATION : GRANT.authorization;
      if (legacy) await seedLegacy(h);
      else assert.equal((await h.post('audit-a', 'audit-key-a')).status, 200);
      if (failure === 'changed') h.setHead('b'.repeat(40));
      else h.failHead();
      const before = structuredClone([...h.state]);
      const replay = await h.post('audit-a', 'audit-key-a', auth);
      assert.equal(replay.status, 409);
      assert.equal(replay.body.verdict, 'BLOCKED');
      assert.equal(replay.body.ready_gate_safe, 'NO');
      assert.equal(replay.body.consequential_gate_evidence_available, false);
      assert.equal(h.counts.model, legacy ? 0 : 1);
      assert.equal(h.counts.persistence, legacy ? 0 : 1);
      assert.deepEqual([...h.state], before);
    });
  }
}

it('F2 canonical EA changed during context preparation blocks the reserved attempt', async () => {
  const h = harness({ mutateAfterAdmission: true });
  assert.equal((await h.post('audit-a', 'audit-key-a')).status, 409);
  assert.equal(h.state.get(GRANT_KEY).state, 'CLOSED_NO_CALL');
  assert.equal(h.counts.model, 0);
  h.reconstruct();
  assert.equal((await h.post('audit-b', 'audit-key-b')).status, 409);
});

it('F2 duplicate manifest keys are ambiguous even with caller-updated digest', async () => {
  const h = harness();
  const receipt = structuredClone(GRANT.receipt);
  receipt.body = receipt.body.replace('{', '{"modelRequestLimit":2,');
  h.grants.set(9001, receipt);
  const auth = { ...GRANT.authorization, issuanceDigest: sha256(receipt.body) };
  assert.equal((await h.post('audit-a', 'audit-key-a', auth)).status, 409);
  assert.equal(h.counts.model, 0);
});
