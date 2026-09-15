import { createHash } from 'node:crypto';
import { requestHash } from '../src/hash.js';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { BrokerDurableObject } from '../src/index.js';

// Broker-side S-0010 Revision 3 integration, entirely offline.
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
      node_id: 'IC_kwDOTest' + String(id),
      created_at: '2026-09-10T00:00:00Z', updated_at: '2026-09-10T00:00:00Z' } };
}
const GRANT = issuedGrant();
const GRANT_KEY = 'review:grant:' + GRANT.authorization.grantId;

function harness({ interruptFinalization = false, failReadback = false, holdFirstModel = false, providerFailure = null, failReservation = false, failConsumption = false, mutateAfterAdmission = false, crashDuringVerify = false, tamperReadback = false, commitReservationThenThrow = false } = {}) {
  const state = new Map();
  const grants = new Map([[9001, structuredClone(GRANT.receipt)]]);
  let currentHead = HEAD;
  let headFailure = false;
  const transitions = [];
  const transactions = [];
  const comments = new Map();
  const counts = { model: 0, persistence: 0, headReads: 0, githubCalls: 0 };
  const modelRequests = [];
  let interrupted = false;
  let verifyCrashes = crashDuringVerify ? 1 : 0;
  let signalModelStarted;
  let signalSecondForwarded;
  let forwarded = 0;
  let releaseModel;
  const modelStarted = new Promise(resolve => { signalModelStarted = resolve; });
  const modelReleased = new Promise(resolve => { releaseModel = resolve; });
  const secondForwarded = new Promise(resolve => { signalSecondForwarded = resolve; });
  // Transactions serialize across reconstructed DO instances and roll back on rejection.
  let transactionTail = Promise.resolve();
  let committedCrash = false;
  const putInto = async (target, key, value) => {
    const entries = typeof key === 'object' ? Object.entries(key) : [[key, value]];
    transitions.push(structuredClone(entries));
    if (failReservation && entries.some(([k,v]) => k === GRANT_KEY && v.state === 'RESERVED')) throw new Error('reservation failure');
    if (failConsumption && entries.some(([k,v]) => k === GRANT_KEY && v.state === 'CONSUMED')) throw new Error('consumption failure');
    if (interruptFinalization && !interrupted && entries.some(([k,v]) => k.startsWith('idem:') && v.state === 'SUCCEEDED')) {
      interrupted = true;
      throw new Error('crash before finalization');
    }
    for (const [k,v] of entries) target.set(k, structuredClone(v));
  };
  const storage = {
    async get(key) { return structuredClone(state.get(key)); },
    async put(key, value) { return putInto(state, key, value); },
    async transaction(callback) {
      const operation = transactionTail.then(async () => {
        const snapshot = structuredClone(state);
        const result = await callback({
          async get(key) { return structuredClone(snapshot.get(key)); },
          async put(key, value) { return putInto(snapshot, key, value); },
        });
        transactions.push(structuredClone(snapshot));
        state.clear();
        for (const [key,value] of snapshot) state.set(key, value);
        if (commitReservationThenThrow && !committedCrash && state.get(GRANT_KEY)?.state === 'RESERVED') {
          committedCrash = true;
          throw new Error('simulated loss of response after reservation commit');
        }
        return result;
      });
      transactionTail = operation.catch(() => {});
      return operation;
    },
  };
  const github = {
    async getPull(number) {
      assert.equal(number, 112); counts.headReads++;
      if (mutateAfterAdmission) grants.get(9001).lastEditedAt = '2026-09-10T00:00:01Z'; counts.githubCalls++;
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
      if (verifyCrashes > 0 && grants.has(id)) {
        verifyCrashes -= 1;
        throw new Error('simulated crash during canonical grant verification');
      }
      if (grants.has(id)) return { ok: true, status: 200, data: structuredClone(grants.get(id)) };
      if (failReadback) return { ok: false, status: 503 };
      return { ok: true, status: 200, data: {
        id, issue_url: 'https://api.github.com/repos/kubzik96/genesis-ai/issues/112', body: tamperReadback ? comments.get(id)?.replace(/"commandHash":"[a-f0-9]+"/, '"commandHash":"' + 'f'.repeat(64) + '"') : comments.get(id),
      } };
    },
    async getIssueCommentEditMetadata(nodeId) {
      counts.githubCalls++;
      const match = [...grants.entries()].find(([, receipt]) => receipt.node_id === nodeId);
      if (!match) return { ok: false, status: 404, data: { data: { node: null } } };
      const [id, receipt] = match;
      return {
        ok: true,
        status: 200,
        data: {
          data: {
            node: {
              id: receipt.node_id,
              databaseId: id,
              lastEditedAt: receipt.lastEditedAt === undefined ? null : receipt.lastEditedAt,
              editor: receipt.lastEditedAt ? { login: 'kubzik96' } : null,
            },
          },
        },
      };
    },
  };
  const env = {
    BROKER_SERVICE_TOKEN: 'offline-service-fixture', GITHUB_PAT: 'offline-github-fixture',
    XAI_API_KEY: 'offline-model-fixture', XAI_REVIEWER_LIVE_ENABLED: 'true',
    GITHUB_REVIEW_BRIDGE_ENABLED: 'true',
    GITHUB_REVIEW_BRIDGE_CONFIG: JSON.stringify({ producerAppId: 123, installationId: 456, eventName: 'repository_dispatch', eventAction: 'review_command' }),
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
    env, counts, state, comments, grants, transitions, transactions, modelRequests, modelStarted, secondForwarded, releaseModel,
    setHead(sha) { currentHead = sha; },
    failHead() { headFailure = true; },
    reconstruct() { object = new BrokerDurableObject({ storage }, env); },
    async send(body, { path = '/v1/reviews/grok/bridge', key = 'bridge-key-a', token = 'offline-service-fixture' } = {}) {
      const response = await worker.fetch(new Request('https://broker.invalid' + path, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'idempotency-key': key },
        body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body),
      }), env);
      return { status: response.status, body: await response.json() };
    },
    async post(overrides = {}, options = {}) {
      return this.send(payload(overrides), options);
    },
  };
}

const CONTEXT = 'Bounded offline canonical audit context';
const COMMAND = Object.freeze({
  action: 'request_review', commandId: 'github-review-command:123',
  deliveryId: '00000000-0000-4000-8000-000000000001',
  eventAction: 'review_command', eventName: 'repository_dispatch',
  expectedHeadSha: HEAD, grantId: GRANT.authorization.grantId,
  installationId: 456, issuanceDigest: GRANT.authorization.issuanceDigest,
  manifestHash: GRANT.authorization.manifestHash, prNumber: 112, producerAppId: 123,
  repository: 'kubzik96/genesis-ai', version: 'genesis.review-command.v1',
});
const canonical = command => JSON.stringify(Object.fromEntries(Object.entries(command).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
function payload(overrides = {}) {
  return { command: canonical(COMMAND), authorization: GRANT.authorization, context: CONTEXT, run_id: 'bridge-run-a', ...overrides };
}
function assertBlocked(result, h, models = 0) {
  assert.ok(result.status >= 400, JSON.stringify(result));
  assert.equal(h.counts.model, models, 'no additional model dispatch');
}

it('bridge positive path reuses existing reviewer hash and writes correlated read-back evidence once', async () => {
  const h = harness();
  const first = await h.post();
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.equal(first.body.consequential_gate_evidence_available, true);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  const record = h.state.get('idem:bridge-key-a');
  assert.equal(record.request_hash, await requestHash({ op: 'review_grok', run_id: 'bridge-run-a', authorization: GRANT.authorization, context: CONTEXT }));
  const evidence = JSON.parse(h.comments.get(1).slice('GENESIS_REVIEW_EVIDENCE_V2 '.length));
  assert.equal(evidence.bridge.commandHash, sha256(canonical(COMMAND)));
  for (const key of ['commandId','deliveryId','producerAppId','installationId','eventName','eventAction']) assert.equal(evidence.bridge[key], COMMAND[key]);
  assert.equal(evidence.grantId, COMMAND.grantId);
  assert.equal(evidence.manifestHash, COMMAND.manifestHash);
  assert.equal(evidence.issuanceDigest, COMMAND.issuanceDigest);
  assert.equal(evidence.request_hash, record.request_hash);
  assert.equal(evidence.expected_head_sha, HEAD);
  assert.equal(evidence.reviewed_head_sha, HEAD);
  assert.equal(h.state.get(GRANT_KEY).evidence_receipt.read_back_verified, true);
  assert.equal(h.state.get(GRANT_KEY).bridge.commandHash, evidence.bridge.commandHash);
  assert.ok(h.state.has('review:command:' + COMMAND.commandId));
  assert.ok(h.state.has('review:delivery:' + COMMAND.deliveryId));
  const reserved = h.transactions.find(tx => tx.get(GRANT_KEY)?.state === 'RESERVED');
  assert.ok(reserved, 'one authoritative transaction reserves grant and all command identities');
  assert.ok(reserved.has('idem:bridge-key-a'));
  assert.ok(reserved.has('review:command:' + COMMAND.commandId));
  assert.ok(reserved.has('review:delivery:' + COMMAND.deliveryId));
  assert.equal(reserved.get(GRANT_KEY).request_hash, record.request_hash);
  assert.equal(reserved.get(GRANT_KEY).expected_head_sha, HEAD);
});

it('direct contract remains executable without bridge gates or configuration', async () => {
  const h = harness();
  delete h.env.GITHUB_REVIEW_BRIDGE_CONFIG;
  delete h.env.GITHUB_REVIEW_BRIDGE_ENABLED;
  const body = payload(); delete body.command;
  assert.equal((await h.send(body, { path: '/v1/reviews/grok' })).status, 200);
  assert.equal(h.counts.model, 1);
  assert.equal(h.counts.persistence, 1);
  assert.equal([...h.state.keys()].some(k => k.startsWith('review:command:')), false);
});

it('anti-downgrade: direct refuses bridge payload and bridge refuses payload with command stripped', async () => {
  const h = harness();
  assertBlocked(await h.post({}, { path: '/v1/reviews/grok' }), h);
  const body = payload(); delete body.command;
  assertBlocked(await h.send(body), h);
  assert.equal(h.state.size, 0);
  assert.equal(h.counts.persistence, 0);
});

it('direct rejects caller-supplied generated bridge envelope rather than trusting metadata', async () => {
  const h = harness();
  const body = payload(); delete body.command;
  body.bridge = { version: 'genesis.review-bridge.v1', commandId: COMMAND.commandId, commandHash: sha256(canonical(COMMAND)), deliveryId: COMMAND.deliveryId, producerAppId: 123, installationId: 456, eventName: COMMAND.eventName, eventAction: COMMAND.eventAction };
  assertBlocked(await h.send(body, { path: '/v1/reviews/grok' }), h);
  assert.equal(h.state.size, 0);
});

for (const gate of [undefined, 'false', true, 'TRUE']) {
  it('bridge default-OFF rejects gate ' + String(gate) + ' before durable mutation', async () => {
    const h = harness(); h.env.GITHUB_REVIEW_BRIDGE_ENABLED = gate;
    assertBlocked(await h.post(), h);
    assert.equal(h.transitions.length, 0);
    assert.equal(h.counts.githubCalls, 0);
  });
}

it('reviewer OFF cannot be bypassed with an injected mock client through bridge', async () => {
  const h = harness();
  h.env.XAI_REVIEWER_LIVE_ENABLED = 'false';
  h.env._reviewClient = { async review() { h.counts.model++; throw new Error('must not dispatch'); } };
  assertBlocked(await h.post(), h);
  assert.equal(h.counts.persistence, 0);
});

for (const config of [undefined, '', '{}', '{', JSON.stringify({ producerAppId: 123, installationId: 456, eventName: 'repository_dispatch', eventAction: 'review_command', extra: true })]) {
  it('missing or non-closed trusted configuration fails before reservation: ' + String(config), async () => {
    const h = harness(); h.env.GITHUB_REVIEW_BRIDGE_CONFIG = config;
    assertBlocked(await h.post(), h);
    assert.equal(h.state.size, 0);
  });
}

it('invalid admission authentication cannot reserve command or grant', async () => {
  const h = harness();
  assertBlocked(await h.post({}, { token: 'invalid-fixture' }), h);
  assert.equal(h.state.size, 0);
  assert.equal(h.counts.githubCalls, 0);
});

for (const [name, value] of [
  ['repository', 'other/repo'], ['producerAppId', 987], ['installationId', 987],
  ['eventName', 'push'], ['eventAction', 'unapproved'], ['action', 'merge'],
  ['grantId', 'github:issue-comment:9002'], ['expectedHeadSha', 'b'.repeat(40)],
  ['manifestHash', 'f'.repeat(64)], ['issuanceDigest', 'f'.repeat(64)],
  ['prNumber', 113], ['version', 'genesis.review-command.v2'],
]) {
  it('closed producer and grant binding rejects wrong ' + name, async () => {
    const h = harness();
    assertBlocked(await h.post({ command: canonical({ ...COMMAND, [name]: value }) }), h);
    assert.equal(h.state.size, 0);
  });
}

for (const [name, change] of [
  ['extra', c => ({ ...c, unexpected: 1 })],
  ['missing', c => { delete c.deliveryId; return c; }],
  ['null', c => ({ ...c, commandId: null })],
  ['nested', c => ({ ...c, commandId: { value: c.commandId } })],
  ['wrong type', c => ({ ...c, producerAppId: '123' })],
]) {
  it('closed command schema rejects ' + name, async () => {
    const h = harness();
    assertBlocked(await h.post({ command: canonical(change({ ...COMMAND })) }), h);
    assert.equal(h.state.size, 0);
  });
}

for (const [name, command] of [
  ['whitespace', ' ' + canonical(COMMAND)],
  ['key order', JSON.stringify(Object.fromEntries(Object.entries(COMMAND).reverse()))],
  ['nonshortest integer', canonical(COMMAND).replace('"producerAppId":123', '"producerAppId":123.0')],
  ['exponent integer', canonical(COMMAND).replace('"producerAppId":123', '"producerAppId":1.23e2')],
  ['duplicate member', canonical(COMMAND).replace('{', '{"action":"request_review",')],
]) {
  it('canonical executable bytes reject ' + name, async () => {
    const h = harness();
    assertBlocked(await h.post({ command }), h);
    assert.equal(h.state.size, 0);
  });
}

for (const member of ['authorization', 'context', 'run_id', 'bridge', 'command']) {
  it('duplicate top-level ' + member + ' rejected before durable admission', async () => {
    const h = harness();
    const body = JSON.stringify(payload());
    const duplicate = '{' + JSON.stringify(member) + ':null,' + JSON.stringify(member) + ':null,' + body.slice(1);
    assertBlocked(await h.send(duplicate), h);
    assert.equal(h.state.size, 0);
  });
}

for (const [name, bytes] of [
  ['malformed UTF-8', new Uint8Array([123,34,120,34,58,34,0xc0,0xaf,34,125])],
  ['UTF-8 BOM', new Uint8Array([0xef,0xbb,0xbf,...new TextEncoder().encode(JSON.stringify(payload()))])],
  ['malformed JSON', '{'],
]) {
  it('raw-body rejects ' + name + ' with zero dispatch or reservation', async () => {
    const h = harness();
    assertBlocked(await h.send(bytes), h);
    assert.equal(h.state.size, 0);
  });
}

it('bridge exact replay after reconstruction returns stored outcome with fresh HEAD read and no writes', async () => {
  const h = harness(); const first = await h.post();
  assert.equal(first.status, 200);
  const before = structuredClone([...h.state]); const writes = h.transitions.length; const reads = h.counts.headReads;
  h.reconstruct();
  assert.deepEqual(await h.post(), first);
  assert.equal(h.counts.headReads, reads + 1);
  assert.equal(h.counts.model, 1); assert.equal(h.counts.persistence, 1);
  assert.equal(h.transitions.length, writes); assert.deepEqual([...h.state], before);
});

for (const stale of ['changed', 'unavailable']) {
  it('F1 bridge replay ' + stale + ' HEAD fails closed without second dispatch or persistence', async () => {
    const h = harness(); assert.equal((await h.post()).status, 200);
    if (stale === 'changed') h.setHead('b'.repeat(40)); else h.failHead();
    const before = structuredClone([...h.state]);
    const replay = await h.post(); assertBlocked(replay, h, 1);
    assert.equal(replay.body.ready_gate_safe, 'NO');
    assert.equal(replay.body.consequential_gate_evidence_available, false);
    assert.equal(h.counts.persistence, 1); assert.deepEqual([...h.state], before);
  });
}

it('stale initial expected HEAD cannot dispatch and cannot be reused after reconstruction', async () => {
  const h = harness(); h.setHead('b'.repeat(40));
  assertBlocked(await h.post(), h);
  h.setHead(HEAD); h.reconstruct();
  assertBlocked(await h.post({ run_id: 'new-run' }, { key: 'new-key' }), h);
});

for (const [name, change] of [
  ['same request duplicate delivery', () => ({})],
  ['same command different delivery', () => ({ command: canonical({ ...COMMAND, deliveryId: '00000000-0000-4000-8000-000000000002' }), run_id: 'competing-run' })],
  ['same grant competing command', () => ({ command: canonical({ ...COMMAND, commandId: 'github-review-command:456', deliveryId: '00000000-0000-4000-8000-000000000002' }), run_id: 'competing-run' })],
  ['same delivery competing command', () => ({ command: canonical({ ...COMMAND, commandId: 'github-review-command:456' }), run_id: 'competing-run' })],
]) {
  it('concurrent reconstructed DO: ' + name + ' admits at most one dispatch', async () => {
    const h = harness();
    const first = h.post(); h.reconstruct();
    const second = h.post(change(), { key: 'competing-key' });
    const responses = await Promise.all([first, second]);
    assert.ok(responses.some(r => r.status === 200), JSON.stringify(responses));
    assert.equal(h.counts.model, 1);
    assert.equal(h.counts.persistence, 1);
  });
}

it('F2 consumed bridge grant cannot be reused by changing both technical identifiers', async () => {
  const h = harness(); assert.equal((await h.post()).status, 200);
  h.reconstruct(); assertBlocked(await h.post({ run_id: 'other-run' }, { key: 'other-key' }), h, 1);
  assert.equal(h.counts.persistence, 1);
});

for (const outcome of ['throw', 'malformed', 'timeout']) {
  it('bridge provider ' + outcome + ' remains consumed and never retries', async () => {
    const h = harness({ providerFailure: outcome });
    assertBlocked(await h.post(), h, 1);
    h.reconstruct(); assertBlocked(await h.post({ run_id: 'other-run' }, { key: 'other-key' }), h, 1);
    assert.equal(h.counts.persistence, 0);
  });
}

it('bridge reservation transaction failure rolls back and cannot dispatch', async () => {
  const h = harness({ failReservation: true });
  assertBlocked(await h.post(), h);
  assert.equal(h.counts.persistence, 0);
  assert.equal(h.state.has(GRANT_KEY), false);
  assert.equal(h.state.has('review:command:' + COMMAND.commandId), false);
  assert.equal(h.state.has('review:delivery:' + COMMAND.deliveryId), false);
});

it('bridge reservation committed but response lost leaves non-reusable authority after reconstruction', async () => {
  const h = harness({ commitReservationThenThrow: true });
  assertBlocked(await h.post(), h);
  assert.ok(h.state.has(GRANT_KEY));
  h.reconstruct(); assertBlocked(await h.post(), h);
  assertBlocked(await h.post({ run_id: 'other-run' }, { key: 'other-key' }), h);
});

it('bridge ambiguous consumption persistence fails closed without any dispatch', async () => {
  const h = harness({ failConsumption: true });
  assertBlocked(await h.post(), h);
  h.reconstruct(); assertBlocked(await h.post(), h);
  assertBlocked(await h.post({ run_id: 'other-run' }, { key: 'other-key' }), h);
});

for (const fault of ['failReadback', 'tamperReadback', 'interruptFinalization']) {
  it('bridge ' + fault + ' allows only read-only recovery, never another dispatch', async () => {
    const h = harness({ [fault]: true });
    assertBlocked(await h.post(), h, 1);
    assert.equal(h.counts.persistence, 1);
    if (fault !== 'interruptFinalization') assert.equal(h.state.get('idem:bridge-key-a').state, 'UNKNOWN');
    h.reconstruct(); assertBlocked(await h.post(), h, 1);
    assertBlocked(await h.post({ run_id: 'other-run' }, { key: 'other-key' }), h, 1);
    assert.equal(h.counts.persistence, 1);
  });
}

for (const missing of ['command', 'delivery', 'grant']) {
  it('bridge positive replay fails closed if durable ' + missing + ' binding is missing', async () => {
    const h = harness();
    assert.equal((await h.post()).status, 200);
    const key = missing === 'command' ? 'review:command:' + COMMAND.commandId
      : missing === 'delivery' ? 'review:delivery:' + COMMAND.deliveryId : GRANT_KEY;
    h.state.delete(key);
    h.reconstruct();
    const result = await h.post();
    assertBlocked(result, h, 1);
    assert.equal(result.body.consequential_gate_evidence_available, false);
    assert.equal(h.counts.persistence, 1);
  });
}

for (const field of ['manifestHash', 'issuanceDigest', 'repository', 'pr_number', 'expected_head_sha', 'consumption_key', 'outcome_key']) {
  it('bridge positive replay rejects corrupted stored index ' + field, async () => {
    const h = harness();
    assert.equal((await h.post()).status, 200);
    h.state.get('review:command:' + COMMAND.commandId)[field] = 'corrupted';
    assertBlocked(await h.post(), h, 1);
    assert.equal(h.counts.persistence, 1);
  });
}
