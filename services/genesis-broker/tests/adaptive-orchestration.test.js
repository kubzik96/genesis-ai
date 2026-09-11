import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_HASH_MODE, DESTINATION_CLASS, MemoryOrchestrationStore, canonicalEventHash,
  canonicalProviderDescriptor, hashEffectRequest, providerDescriptorHash, routeProvider, transitionAttempt,
} from '../src/adaptive-orchestration.js';

const descriptor = (overrides = {}) => ({ providerId: 'grok', adapterId: 'xai', modelId: 'm1', capabilities: ['review', 'code'], roles: ['reviewer'], independenceClass: ['independent'], permissionsClass: ['read'], invocationModes: ['async'], costClass: 'metered', ...overrides });
const resource = (overrides = {}) => ({ available: true, invokable: true, credentialReady: true, cost: { amount: 1, currency: 'USD' }, ...overrides });
const requirements = (overrides = {}) => ({ capabilities: ['review'], roles: ['reviewer'], permissions: ['read'], independence: 'independent', authority: 'CEO_EA', criticality: 'normal', budget: { amount: 2, currency: 'USD' }, ...overrides });
const grant = (overrides = {}) => ({ grantId: 'github:issue-comment:1', manifestHash: '1'.repeat(64), issuanceDigest: '2'.repeat(64), retries: 1, ...overrides });
const event = (overrides = {}) => ({ sourceNamespace: 'github', providerId: 'grok', adapterId: 'xai', eventId: 'evt-1', runId: 'run-1', attemptId: 'attempt-1', payload: { verdict: 'APPROVE' }, ...overrides });
const receipt = (overrides = {}) => ({ providerId: 'grok', adapterId: 'xai', runId: 'run-1', attemptId: 'attempt-1', ...overrides });

describe('Slice A provider contracts and deterministic router', () => {
  it('canonicalizes descriptor set fields and preserves a fixed hash vector', () => {
    const a = descriptor({ capabilities: ['review', 'code'], invocationModes: ['async', 'sync'] });
    const b = { ...a, capabilities: ['code', 'review'], invocationModes: ['sync', 'async'] };
    assert.deepEqual(canonicalProviderDescriptor(a), canonicalProviderDescriptor(b));
    assert.equal(providerDescriptorHash(a), providerDescriptorHash(b));
    assert.match(providerDescriptorHash(a), /^[a-f0-9]{64}$/);
  });
  it('candidate input permutations produce the same total-order winner', () => {
    const a = { descriptor: descriptor({ providerId: 'zeta' }), resource: resource(), score: 5 };
    const b = { descriptor: descriptor({ providerId: 'alpha' }), resource: resource(), score: 5 };
    assert.equal(routeProvider({ requirements: requirements(), candidates: [a, b] }).selected.providerId, 'alpha');
    assert.equal(routeProvider({ requirements: requirements(), candidates: [b, a] }).selected.providerId, 'alpha');
  });
  it('unknown security/resource state fails closed', () => {
    const result = routeProvider({ requirements: requirements(), candidates: [{ descriptor: descriptor({ permissionsClass: undefined }), resource: resource() }] });
    assert.equal(result.status, 'BLOCKED');
  });
  it('unknown or incompatible cost is rejected', () => {
    assert.equal(routeProvider({ requirements: requirements(), candidates: [{ descriptor: descriptor(), resource: resource({ cost: undefined }) }] }).status, 'BLOCKED');
    assert.equal(routeProvider({ requirements: requirements(), candidates: [{ descriptor: descriptor(), resource: resource({ cost: { amount: 1, currency: 'EUR' } }) }] }).status, 'BLOCKED');
  });
});

describe('Slice B event, attempt and checkpoint contracts', () => {
  it('duplicate event creates no second continuation', () => {
    const store = new MemoryOrchestrationStore(); const first = store.acceptEvent(event(), receipt()); const second = store.acceptEvent(event(), receipt());
    assert.equal(first.duplicate, false); assert.equal(second.duplicate, true); assert.equal(store.checkpoints.size, 1);
  });
  it('same event identity with changed payload is a collision', () => {
    const store = new MemoryOrchestrationStore(); store.acceptEvent(event(), receipt());
    assert.throws(() => store.acceptEvent(event({ payload: { verdict: 'REQUEST_CHANGES' } }), receipt()), /EVENT_IDENTITY_COLLISION/);
  });
  it('delimiter/control-character identity attacks fail closed', () => assert.throws(() => canonicalEventHash(event({ eventId: 'x\nattack' })), /INVALID_EVENTID/));
  it('wrong attempt receipt is blocked', () => assert.throws(() => new MemoryOrchestrationStore().acceptEvent(event(), receipt({ attemptId: 'stale' })), /RECEIPT_CORRELATION_MISMATCH/));
  it('terminal attempt state cannot regress', () => { assert.equal(transitionAttempt('WAITING', 'COMPLETED'), 'COMPLETED'); assert.throws(() => transitionAttempt('COMPLETED', 'WAITING'), /ATTEMPT_TERMINAL_REGRESSION/); });
  it('concurrent checkpoint claims have one owner', () => {
    const store = new MemoryOrchestrationStore(); const cp = store.acceptEvent(event(), receipt()).checkpoint;
    const first = store.claimCheckpoint(cp.id, 'controller-a'); const second = store.claimCheckpoint(cp.id, 'controller-b');
    assert.ok(first); assert.equal(second, null); assert.throws(() => store.finishCheckpoint(cp.id, 'controller-b', first.fence, 'COMPLETED'), /STALE_CHECKPOINT_OWNER/);
  });
});

describe('Slice B crash-safe effects', () => {
  it('structured key order is equivalent and fixed vector matches S-0011', () => {
    const a = hashEffectRequest({ mode: EFFECT_HASH_MODE.STRUCTURED, payload: { action: 'comment', body: 'ok' } });
    const b = hashEffectRequest({ mode: EFFECT_HASH_MODE.STRUCTURED, payload: { body: 'ok', action: 'comment' } });
    assert.equal(a.digest, b.digest); assert.equal(a.digest, '0d9d73f8d53d215cbf25bb17c93e0053a858c7def120f2547b67d53dfa4cb86c');
  });
  it('EXACT_BYTES differs for different transmitted bytes and reproduces across controllers', () => {
    const one = hashEffectRequest({ mode: EFFECT_HASH_MODE.BYTES, bytes: new TextEncoder().encode('abc') });
    const two = hashEffectRequest({ mode: EFFECT_HASH_MODE.BYTES, bytes: new TextEncoder().encode('abd') });
    const again = hashEffectRequest({ mode: EFFECT_HASH_MODE.BYTES, bytes: new Uint8Array([97, 98, 99]) });
    assert.notEqual(one.digest, two.digest); assert.equal(one.digest, again.digest);
  });
  it('changed effect payload conflicts with durable binding', () => {
    const store = new MemoryOrchestrationStore(); store.prepareEffect({ operationId: 'op', destinationClass: DESTINATION_CLASS.C, request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: { x: 1 } }, grant: grant() });
    assert.throws(() => store.prepareEffect({ operationId: 'op', destinationClass: DESTINATION_CLASS.C, request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: { x: 2 } }, grant: grant() }), /EFFECT_BINDING_CONFLICT/);
  });
  it('crash before dispatch leaves PREPARED and crash after DISPATCHING reconciles class C to indeterminate', () => {
    const store = new MemoryOrchestrationStore(); const effect = store.prepareEffect({ operationId: 'op', destinationClass: DESTINATION_CLASS.C, request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: { x: 1 } }, grant: grant() });
    assert.equal(effect.state, 'PREPARED'); store.beginDispatch('op'); store.reconcile('op', { authoritative: false, readOnly: true }); assert.equal(effect.state, 'UNKNOWN');
    store.reconcile('op', { authoritative: true, readOnly: true, outcome: 'AMBIGUOUS' }); assert.equal(effect.state, 'INDETERMINATE_EFFECT');
  });
  it('class C ambiguous dispatch cannot replay and delayed former sender must be excluded', () => {
    const store = new MemoryOrchestrationStore(); const effect = store.prepareEffect({ operationId: 'op', destinationClass: DESTINATION_CLASS.C, request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: { x: 1 } }, grant: grant({ retries: 2 }) });
    store.beginDispatch('op'); store.reconcile('op', { authoritative: true, readOnly: true, outcome: 'NO_EFFECT', formerSendersExcluded: true });
    assert.throws(() => store.beginDispatch('op', { authorityAllowsRetry: true, formerSendersExcluded: false }), /RETRY_NOT_AUTHORIZED_OR_FENCED/);
    assert.equal(store.beginDispatch('op', { authorityAllowsRetry: true, formerSendersExcluded: true }).number, 2);
  });
  it('S-0010 retries=0 is stricter than generic destination retry', () => {
    const store = new MemoryOrchestrationStore(); store.prepareEffect({ operationId: 'review', destinationClass: DESTINATION_CLASS.A, request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: { review: true } }, grant: grant({ retries: 0 }) });
    store.beginDispatch('review'); store.reconcile('review', { authoritative: true, readOnly: true, outcome: 'NO_EFFECT', formerSendersExcluded: true });
    assert.throws(() => store.beginDispatch('review', { authorityAllowsRetry: true, formerSendersExcluded: true }), /GRANT_RETRY_FORBIDDEN/);
  });
  it('malformed grant/recovery state fails closed', () => {
    const store = new MemoryOrchestrationStore();
    assert.throws(() => store.prepareEffect({ operationId: 'bad', request: { mode: EFFECT_HASH_MODE.STRUCTURED, payload: {} }, grant: { grantId: 'x' } }), /INVALID_GRANT_TUPLE/);
    assert.throws(() => hashEffectRequest({ mode: 'UNKNOWN', payload: {} }), /UNKNOWN_EFFECT_HASH_MODE/);
  });
});
