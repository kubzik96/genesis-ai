import { createHash } from 'node:crypto';

const DIGEST = /^[a-f0-9]{64}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const SECURITY_FIELDS = ['capabilities', 'roles', 'independenceClass', 'permissionsClass', 'invocationModes', 'costClass'];

export const EFFECT_HASH_MODE = Object.freeze({ STRUCTURED: 'STRUCTURED_CANONICAL_JSON', BYTES: 'EXACT_BYTES' });
export const DESTINATION_CLASS = Object.freeze({ A: 'IDEMPOTENT_DESTINATION', B: 'TRANSACTIONAL_EFFECT', C: 'NON_IDEMPOTENT_NON_TRANSACTIONAL' });
export const ATTEMPT_TERMINAL = new Set(['COMPLETED', 'FAILED', 'FAILED_NO_DISPATCH', 'CANCELLED', 'UNKNOWN']);
export const CHECKPOINT_TERMINAL = new Set(['COMPLETED', 'BLOCKED', 'UNKNOWN']);

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function text(value, code) { if (typeof value !== 'string' || !value || CONTROL.test(value)) fail(code); return value; }
function sortedUnique(values, code) {
  if (!Array.isArray(values) || values.length === 0) fail(code);
  const out = values.map(v => text(v, code)).sort();
  if (new Set(out).size !== out.length) fail(code);
  return out;
}
export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('NON_CANONICAL_NUMBER'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!plain(value)) fail('NON_CANONICAL_VALUE');
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

export function canonicalProviderDescriptor(input) {
  if (!plain(input)) fail('INVALID_PROVIDER_DESCRIPTOR');
  const providerId = text(input.providerId, 'INVALID_PROVIDER_ID');
  const adapterId = text(input.adapterId, 'INVALID_ADAPTER_ID');
  const descriptor = { providerId, adapterId };
  for (const key of SECURITY_FIELDS) {
    if (key === 'costClass') descriptor[key] = text(input[key], `INVALID_${key.toUpperCase()}`);
    else descriptor[key] = sortedUnique(input[key], `INVALID_${key.toUpperCase()}`);
  }
  if (input.modelId != null) descriptor.modelId = text(input.modelId, 'INVALID_MODEL_ID');
  return descriptor;
}
export function providerDescriptorHash(input) { return sha256(canonicalJson(canonicalProviderDescriptor(input))); }

export function validateResourceSnapshot(input) {
  if (!plain(input)) fail('INVALID_RESOURCE_SNAPSHOT');
  for (const key of ['available', 'invokable', 'credentialReady']) if (typeof input[key] !== 'boolean') fail(`UNKNOWN_${key.toUpperCase()}`);
  const cost = input.cost;
  if (cost != null && (!plain(cost) || !Number.isFinite(cost.amount) || cost.amount < 0 || typeof cost.currency !== 'string' || !cost.currency)) fail('INVALID_COST');
  return { available: input.available, invokable: input.invokable, credentialReady: input.credentialReady, quota: input.quota ?? 'UNKNOWN', rateLimit: input.rateLimit ?? 'UNKNOWN', latency: input.latency ?? 'UNKNOWN', cost: cost ?? 'UNKNOWN' };
}
export function validateTaskRequirements(input) {
  if (!plain(input)) fail('INVALID_TASK_REQUIREMENTS');
  const required = {
    capabilities: sortedUnique(input.capabilities, 'INVALID_CAPABILITIES'),
    roles: sortedUnique(input.roles, 'INVALID_ROLES'),
    permissions: sortedUnique(input.permissions, 'INVALID_PERMISSIONS'),
    independence: text(input.independence, 'INVALID_INDEPENDENCE'),
    authority: text(input.authority, 'INVALID_AUTHORITY'),
    criticality: text(input.criticality, 'INVALID_CRITICALITY'),
  };
  if (input.allowedProviders != null) required.allowedProviders = sortedUnique(input.allowedProviders, 'INVALID_ALLOWED_PROVIDERS');
  if (input.budget != null) {
    if (!plain(input.budget) || !Number.isFinite(input.budget.amount) || input.budget.amount < 0 || typeof input.budget.currency !== 'string' || !input.budget.currency) fail('INVALID_BUDGET');
    required.budget = { amount: input.budget.amount, currency: input.budget.currency };
  }
  return required;
}
export function validateAuthorityProducer({ authority, producer }) {
  text(authority, 'INVALID_AUTHORITY');
  if (!plain(producer)) fail('INVALID_PRODUCER');
  return { authority, producerId: text(producer.id, 'INVALID_PRODUCER_ID'), independence: text(producer.independence, 'INVALID_PRODUCER_INDEPENDENCE') };
}
function containsAll(have, need) { return need.every(v => have.includes(v)); }
export function routeProvider({ requirements, candidates }) {
  const req = validateTaskRequirements(requirements);
  if (!Array.isArray(candidates)) fail('INVALID_CANDIDATES');
  const admitted = [];
  const rejected = [];
  for (const candidate of candidates) {
    try {
      const descriptor = canonicalProviderDescriptor(candidate.descriptor);
      const resource = validateResourceSnapshot(candidate.resource);
      let reason = null;
      if (!resource.available || !resource.invokable || !resource.credentialReady) reason = 'RESOURCE_NOT_READY';
      else if (!containsAll(descriptor.capabilities, req.capabilities) || !containsAll(descriptor.roles, req.roles) || !containsAll(descriptor.permissionsClass, req.permissions)) reason = 'INCOMPATIBLE_CAPABILITY_OR_PERMISSION';
      else if (!descriptor.independenceClass.includes(req.independence)) reason = 'INCOMPATIBLE_INDEPENDENCE';
      else if (req.allowedProviders && !req.allowedProviders.includes(descriptor.providerId)) reason = 'PROVIDER_NOT_ALLOWED';
      else if (req.budget) {
        if (resource.cost === 'UNKNOWN') reason = 'UNKNOWN_COST';
        else if (resource.cost.currency !== req.budget.currency || resource.cost.amount > req.budget.amount) reason = 'INCOMPATIBLE_COST';
      }
      if (reason) rejected.push({ providerId: descriptor.providerId, adapterId: descriptor.adapterId, reason });
      else admitted.push({ descriptor, resource, score: Number.isFinite(candidate.score) ? candidate.score : 0 });
    } catch (error) { rejected.push({ providerId: candidate?.descriptor?.providerId ?? 'UNKNOWN', adapterId: candidate?.descriptor?.adapterId ?? 'UNKNOWN', reason: error.code ?? 'INVALID_CANDIDATE' }); }
  }
  admitted.sort((a, b) => b.score - a.score || a.descriptor.providerId.localeCompare(b.descriptor.providerId) || a.descriptor.adapterId.localeCompare(b.descriptor.adapterId) || (a.descriptor.modelId ?? '').localeCompare(b.descriptor.modelId ?? ''));
  if (!admitted.length) return { status: 'BLOCKED', selected: null, rejected };
  const winner = admitted[0];
  return { status: 'SELECTED', selected: { providerId: winner.descriptor.providerId, adapterId: winner.descriptor.adapterId, modelId: winner.descriptor.modelId ?? null, descriptorHash: providerDescriptorHash(winner.descriptor) }, rejected };
}

export function canonicalEventIdentity(event) {
  if (!plain(event)) fail('INVALID_EVENT');
  const parts = ['sourceNamespace', 'providerId', 'adapterId', 'eventId'].map(k => text(event[k], `INVALID_${k.toUpperCase()}`));
  return parts.join('\n');
}
export function canonicalEventHash(event) {
  const identity = canonicalEventIdentity(event);
  return sha256(`GENESIS_AGENT_EVENT\0v1\0${identity}\0${canonicalJson(event.payload ?? null)}`);
}
export function correlateReceipt(event, receipt) {
  if (!plain(receipt) || event.runId !== receipt.runId || event.attemptId !== receipt.attemptId || event.providerId !== receipt.providerId || event.adapterId !== receipt.adapterId) fail('RECEIPT_CORRELATION_MISMATCH');
  return true;
}

const ATTEMPT_TRANSITIONS = Object.freeze({ PREPARED: new Set(['FAILED_NO_DISPATCH', 'DISPATCH_CONFIRMED', 'UNKNOWN']), DISPATCH_CONFIRMED: new Set(['WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'UNKNOWN']), WAITING: new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'UNKNOWN']) });
export function transitionAttempt(current, next) {
  if (ATTEMPT_TERMINAL.has(current)) { if (current !== next) fail('ATTEMPT_TERMINAL_REGRESSION'); return current; }
  if (!ATTEMPT_TRANSITIONS[current]?.has(next)) fail('INVALID_ATTEMPT_TRANSITION');
  return next;
}

export class MemoryOrchestrationStore {
  constructor() { this.events = new Map(); this.checkpoints = new Map(); this.effects = new Map(); }
  acceptEvent(event, receipt) {
    correlateReceipt(event, receipt);
    const key = canonicalEventIdentity(event); const hash = canonicalEventHash(event);
    const existing = this.events.get(key);
    if (existing) { if (existing.hash !== hash) fail('EVENT_IDENTITY_COLLISION'); return { duplicate: true, checkpoint: existing.checkpoint }; }
    const checkpoint = { id: `checkpoint:${hash}`, state: 'PENDING', owner: null, fence: 0 };
    this.events.set(key, { hash, checkpoint }); this.checkpoints.set(checkpoint.id, checkpoint);
    return { duplicate: false, checkpoint };
  }
  claimCheckpoint(id, owner) {
    const cp = this.checkpoints.get(id); if (!cp) fail('CHECKPOINT_NOT_FOUND');
    if (CHECKPOINT_TERMINAL.has(cp.state)) fail('CHECKPOINT_TERMINAL');
    if (cp.owner && cp.owner !== owner) return null;
    cp.owner = text(owner, 'INVALID_OWNER'); cp.state = 'IN_PROGRESS'; cp.fence += 1; return { ...cp };
  }
  finishCheckpoint(id, owner, fence, state) {
    const cp = this.checkpoints.get(id); if (!cp || cp.owner !== owner || cp.fence !== fence) fail('STALE_CHECKPOINT_OWNER');
    if (!CHECKPOINT_TERMINAL.has(state)) fail('INVALID_CHECKPOINT_TERMINAL'); cp.state = state; return { ...cp };
  }
  prepareEffect(record) {
    if (!plain(record)) fail('INVALID_EFFECT');
    const operationId = text(record.operationId, 'INVALID_OPERATION_ID');
    const request = hashEffectRequest(record.request);
    const existing = this.effects.get(operationId);
    const bound = { operationId, destinationClass: record.destinationClass ?? DESTINATION_CLASS.C, request, episodes: [], state: 'PREPARED', grant: validateGrantTuple(record.grant) };
    if (existing) { if (canonicalJson(existing.request) !== canonicalJson(request) || existing.destinationClass !== bound.destinationClass) fail('EFFECT_BINDING_CONFLICT'); return existing; }
    this.effects.set(operationId, bound); return bound;
  }
  beginDispatch(operationId, { authorityAllowsRetry = false, formerSendersExcluded = false } = {}) {
    const effect = this.effects.get(operationId); if (!effect) fail('EFFECT_NOT_FOUND');
    if (effect.grant.retries === 0 && effect.episodes.length > 0) fail('GRANT_RETRY_FORBIDDEN');
    const previous = effect.episodes.at(-1);
    if (previous && previous.state !== 'NO_EFFECT') fail('PREVIOUS_EPISODE_NOT_NO_EFFECT');
    if (previous && (!authorityAllowsRetry || !formerSendersExcluded)) fail('RETRY_NOT_AUTHORIZED_OR_FENCED');
    const episode = { number: effect.episodes.length + 1, state: 'DISPATCHING' }; effect.episodes.push(episode); effect.state = 'DISPATCHING'; return episode;
  }
  reconcile(operationId, evidence) {
    const effect = this.effects.get(operationId); if (!effect) fail('EFFECT_NOT_FOUND');
    const episode = effect.episodes.at(-1); if (!episode) return effect;
    if (!plain(evidence) || evidence.authoritative !== true || evidence.readOnly !== true) { episode.state = 'UNKNOWN'; effect.state = 'UNKNOWN'; return effect; }
    if (evidence.outcome === 'SUCCEEDED') { episode.state = 'SUCCEEDED'; effect.state = 'SUCCEEDED'; }
    else if (evidence.outcome === 'NO_EFFECT' && evidence.formerSendersExcluded === true) { episode.state = 'NO_EFFECT'; effect.state = 'NO_EFFECT'; }
    else { episode.state = 'UNKNOWN'; effect.state = effect.destinationClass === DESTINATION_CLASS.C ? 'INDETERMINATE_EFFECT' : 'UNKNOWN'; }
    return effect;
  }
}

export function hashEffectRequest({ mode, payload, bytes, contractVersion = 'v1', contractRef = 'S-0011#effect-request-hashing-v1' }) {
  if (contractVersion !== 'v1') fail('UNKNOWN_EFFECT_HASH_VERSION');
  let preimage;
  if (mode === EFFECT_HASH_MODE.STRUCTURED) preimage = Buffer.from(`GENESIS_EFFECT_REQUEST\0v1\0STRUCTURED_CANONICAL_JSON\0${canonicalJson(payload)}`, 'utf8');
  else if (mode === EFFECT_HASH_MODE.BYTES) { if (!(bytes instanceof Uint8Array)) fail('EXACT_BYTES_REQUIRED'); preimage = Buffer.concat([Buffer.from('GENESIS_EFFECT_REQUEST\0v1\0EXACT_BYTES\0', 'utf8'), Buffer.from(bytes)]); }
  else fail('UNKNOWN_EFFECT_HASH_MODE');
  return { mode, version: contractVersion, contractRef, digest: sha256(preimage) };
}
export function validateGrantTuple(grant) {
  if (!plain(grant) || typeof grant.grantId !== 'string' || !grant.grantId || !DIGEST.test(grant.manifestHash) || !DIGEST.test(grant.issuanceDigest) || !Number.isInteger(grant.retries) || grant.retries < 0) fail('INVALID_GRANT_TUPLE');
  return { grantId: grant.grantId, manifestHash: grant.manifestHash, issuanceDigest: grant.issuanceDigest, retries: grant.retries };
}
