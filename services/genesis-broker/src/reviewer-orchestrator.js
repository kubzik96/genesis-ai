import { acknowledgeDurablePersistence, runGrokReview } from './grok-reviewer.js';
import { containsCredentialLikeValue } from './secret-scan.js';
import { requestHash } from './hash.js';

const SHA = /^[a-f0-9]{40}$/i;
const AUTH_KEYS = new Set([
  'repository',
  'prNumber',
  'expectedHeadSha',
  'reviewPurpose',
  'criteria',
  'artifactProducer',
  'modelCallAuthorized',
  'modelRequestLimit',
  'durablePersistenceAuthorized',
  'forbiddenActions',
]);
const PRODUCERS = new Set(['CODEX', 'HUMAN', 'OTHER_AI', 'GROK_XAI']);
const GRANT_KEYS = ['grantId', 'manifestHash', 'issuanceDigest'];
const GRANT_ID = /^github:issue-comment:([1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const EA_PREFIX = 'GENESIS_REVIEW_GRANT_V1 ';
const REQUIRED_FORBIDDEN_ACTIONS = Object.freeze([
  'READY',
  'MERGE',
  'REMEDIATION',
  'DEPLOY',
  'DIFY',
  'BROKER_AUTH_RUNTIME',
  'CLOUDFLARE',
  'SECRETS',
  'QUARANTINE_REMOVAL',
  'REPEAT_MODEL_CALL',
]);
const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

function blocked(code, message, reviewedHeadSha = null) {
  return Object.freeze({
    ok: false,
    code,
    message,
    verdict: 'BLOCKED',
    reviewedHeadSha,
    readyGateSafe: 'NO',
    consequentialGateEvidenceAvailable: false,
    nextAction: 'STOP_BLOCKED',
  });
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function validateReviewerAuthorization(authorization, request) {
  if (!plainObject(authorization)) return blocked('REVIEW_AUTH_MISSING', 'Bounded reviewer authorization is required');
  if (!plainObject(request)) return blocked('REVIEW_REQUEST_MISSING', 'Prepared S-0009 review request is required');
  const hasGrant = GRANT_KEYS.some((key) => Object.hasOwn(authorization, key));
  const allowed = hasGrant ? new Set([...AUTH_KEYS, ...GRANT_KEYS]) : AUTH_KEYS;
  if (!Object.keys(authorization).every((key) => allowed.has(key)) || Object.keys(authorization).length !== allowed.size) {
    return blocked('REVIEW_AUTH_MALFORMED', 'Reviewer authorization must use the closed S-0010 authorization shape');
  }
  if (hasGrant && (!GRANT_ID.test(authorization.grantId) || !DIGEST.test(authorization.manifestHash)
    || !DIGEST.test(authorization.issuanceDigest))) {
    return blocked('REVIEW_GRANT_MALFORMED', 'Canonical grant identity and digests are required');
  }
  if (containsCredentialLikeValue(JSON.stringify(authorization))) {
    return blocked('REVIEW_AUTH_SECRET_REJECTED', 'Credential-like reviewer authorization is forbidden');
  }
  if (typeof authorization.repository !== 'string' || authorization.repository !== request.repository) {
    return blocked('REVIEW_AUTH_REPOSITORY_MISMATCH', 'Authorization repository must equal review request repository');
  }
  if (!Number.isSafeInteger(authorization.prNumber) || authorization.prNumber < 1 || authorization.prNumber !== request.prNumber) {
    return blocked('REVIEW_AUTH_PR_MISMATCH', 'Authorization PR must equal review request PR');
  }
  if (typeof authorization.expectedHeadSha !== 'string' || !SHA.test(authorization.expectedHeadSha)
    || typeof request.expectedHeadSha !== 'string' || authorization.expectedHeadSha.toLowerCase() !== request.expectedHeadSha.toLowerCase()) {
    return blocked('REVIEW_AUTH_HEAD_MISMATCH', 'Authorization exact HEAD must equal review request exact HEAD');
  }
  if (typeof authorization.reviewPurpose !== 'string' || !authorization.reviewPurpose.trim()) {
    return blocked('REVIEW_AUTH_MALFORMED', 'Authorization review purpose is required');
  }
  if (!sameStringArray(authorization.criteria, request.criteria)
    || authorization.criteria.length === 0
    || authorization.criteria.some((criterion) => typeof criterion !== 'string' || !criterion.trim())) {
    return blocked('REVIEW_AUTH_CRITERIA_MISMATCH', 'Authorization criteria must exactly match prepared review criteria');
  }
  if (!PRODUCERS.has(authorization.artifactProducer)) {
    return blocked('REVIEW_AUTH_MALFORMED', 'Authorization artifact producer is invalid');
  }
  if (authorization.artifactProducer === 'GROK_XAI') {
    return blocked('REVIEW_SELF_REVIEW_FORBIDDEN', 'Grok/xAI cannot be sole independent reviewer of Grok/xAI-produced work');
  }
  if (authorization.artifactProducer !== request.producer) {
    return blocked('REVIEW_AUTH_PRODUCER_MISMATCH', 'Authorization producer must equal prepared request producer');
  }
  if (authorization.modelCallAuthorized !== true || authorization.modelRequestLimit !== 1) {
    return blocked('REVIEW_MODEL_CALL_NOT_AUTHORIZED', 'Exactly one reviewer model request must be explicitly authorized');
  }
  if (authorization.durablePersistenceAuthorized !== true) {
    return blocked('REVIEW_PERSISTENCE_NOT_AUTHORIZED', 'Trusted durable persistence must be explicitly authorized');
  }
  if (!Array.isArray(authorization.forbiddenActions)
    || authorization.forbiddenActions.length !== REQUIRED_FORBIDDEN_ACTIONS.length
    || !REQUIRED_FORBIDDEN_ACTIONS.every((action) => authorization.forbiddenActions.includes(action))) {
    return blocked('REVIEW_AUTHORITY_BOUNDARY_MISSING', 'Authorization must preserve every required forbidden consequential action');
  }
  return Object.freeze({ ok: true, value: Object.freeze({ ...authorization, expectedHeadSha: authorization.expectedHeadSha.toLowerCase() }) });
}

// The fixed GitHub CEO issuance is the identity; execution IDs never mint grants.
// Only a standalone, unedited issuance comment is supported. Prose/agent reviews
// and edited receipts fail closed; later operational gates must issue a new EA.
// Edit provenance uses GraphQL lastEditedAt (null = never edited). REST created_at===updated_at
// is insufficient (second granularity) and is not used as sole immutability proof.
function grantResult(code, message, meta = {}) {
  const base = code ? blocked(code, message) : { ok: true };
  return Object.freeze({
    ...base,
    githubCalled: meta.githubCalled === true,
    githubStatus: Number.isFinite(meta.githubStatus) ? meta.githubStatus : null,
    ...(meta.value ? { value: meta.value } : {}),
  });
}

export async function verifyCanonicalReviewerGrant(authorization, github) {
  const match = typeof authorization?.grantId === 'string' && GRANT_ID.exec(authorization.grantId);
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    return grantResult('REVIEW_GRANT_REQUIRED', 'Fresh execution requires a canonical grant');
  }
  if (typeof github?.getIssueComment !== 'function') {
    return grantResult('REVIEW_GRANT_UNVERIFIABLE', 'Canonical issuance is unavailable or ambiguous');
  }
  let response;
  try {
    response = await github.getIssueComment(Number(match[1]));
  } catch {
    return grantResult('REVIEW_GRANT_UNVERIFIABLE', 'Canonical issuance is unavailable or ambiguous', {
      githubCalled: true,
      githubStatus: null,
    });
  }
  const githubStatus = Number.isFinite(response?.status) ? response.status : null;
  const receipt = response?.data;
  if (response?.ok !== true || response.status !== 200 || receipt?.id !== Number(match[1])
    || receipt.user?.id !== 307621171 || receipt.user?.login !== 'kubzik96'
    || receipt.user?.type !== 'User' || receipt.performed_via_github_app != null
    || !/^https:\/\/api.github.com\/repos\/kubzik96\/genesis-ai\/issues\/[1-9][0-9]*$/.test(receipt.issue_url)
    || typeof receipt.body !== 'string' || !receipt.body.startsWith(EA_PREFIX)
    || new TextEncoder().encode(receipt.body).byteLength > 32768) {
    return grantResult('REVIEW_GRANT_PROVENANCE_INVALID', 'Canonical CEO issuance could not be verified', {
      githubCalled: true,
      githubStatus,
    });
  }

  // Fail-closed immutability: GraphQL lastEditedAt must be explicitly null.
  const nodeId = typeof receipt.node_id === 'string' ? receipt.node_id : null;
  if (!nodeId || typeof github.getIssueCommentEditMetadata !== 'function') {
    return grantResult('REVIEW_GRANT_PROVENANCE_INVALID', 'Canonical CEO issuance could not be verified', {
      githubCalled: true,
      githubStatus,
    });
  }
  let editMeta;
  try {
    editMeta = await github.getIssueCommentEditMetadata(nodeId);
  } catch {
    return grantResult('REVIEW_GRANT_UNVERIFIABLE', 'Canonical issuance is unavailable or ambiguous', {
      githubCalled: true,
      githubStatus: null,
    });
  }
  const editStatus = Number.isFinite(editMeta?.status) ? editMeta.status : null;
  const node = editMeta?.data?.data?.node;
  if (editMeta?.ok !== true || editMeta.status !== 200 || !node
    || node.id !== nodeId
    || node.databaseId !== Number(match[1])
    || node.lastEditedAt !== null) {
    return grantResult('REVIEW_GRANT_PROVENANCE_INVALID', 'Canonical CEO issuance could not be verified', {
      githubCalled: true,
      githubStatus: editStatus ?? githubStatus,
    });
  }

  let digest;
  let canonicalHash;
  try {
    const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(receipt.body));
    digest = [...new Uint8Array(digestBytes)].map((v) => v.toString(16).padStart(2, '0')).join('');
    const manifest = JSON.parse(receipt.body.slice(EA_PREFIX.length));
    if (!plainObject(manifest) || receipt.body !== EA_PREFIX + JSON.stringify(manifest)
      || Object.keys(manifest).length !== AUTH_KEYS.size
      || !Object.keys(manifest).every((key) => AUTH_KEYS.has(key))) {
      return grantResult('REVIEW_GRANT_MANIFEST_INVALID', 'Canonical issuance must contain one closed manifest', {
        githubCalled: true,
        githubStatus,
      });
    }
    const manifestOf = (value) => ({ ...Object.fromEntries([...AUTH_KEYS].map((key) => [key, value[key]])),
      forbiddenActions: [...new Set(value.forbiddenActions)].sort() });
    canonicalHash = await requestHash(manifestOf(manifest));
    if (digest !== authorization.issuanceDigest || canonicalHash !== authorization.manifestHash
      || canonicalHash !== await requestHash(manifestOf(authorization))) {
      return grantResult('REVIEW_GRANT_BINDING_MISMATCH', 'Canonical issuance or immutable conditions changed', {
        githubCalled: true,
        githubStatus,
      });
    }
  } catch {
    return grantResult('REVIEW_GRANT_UNVERIFIABLE', 'Canonical issuance is unavailable or ambiguous', {
      githubCalled: true,
      githubStatus,
    });
  }
  return grantResult(null, null, {
    githubCalled: true,
    githubStatus: 200,
    value: Object.freeze({
      grantId: authorization.grantId,
      manifestHash: canonicalHash,
      issuanceDigest: digest,
      issuanceUrl: `https://api.github.com/repos/kubzik96/genesis-ai/issues/comments/${receipt.id}`,
      issuanceIssueUrl: receipt.issue_url,
    }),
  });
}

export async function orchestrateIndependentReview({
  authorization,
  request,
  getCurrentHead,
  reviewClient,
  persistEvidence,
  verifyPersistence,
  claimDispatch,
} = {}) {
  const validAuthorization = validateReviewerAuthorization(authorization, request);
  if (!validAuthorization.ok) return validAuthorization;
  if (!authorization.grantId || typeof claimDispatch !== 'function') {
    return blocked('REVIEW_GRANT_REQUIRED', 'Fresh execution requires a durable grant dispatch boundary');
  }
  if (typeof getCurrentHead !== 'function' || typeof reviewClient?.review !== 'function') {
    return blocked('REVIEW_BOUNDARY_UNAVAILABLE', 'Trusted HEAD read and reviewer boundaries are required');
  }
  if (typeof persistEvidence !== 'function' || typeof verifyPersistence !== 'function') {
    return blocked('PERSISTENCE_BOUNDARY_UNAVAILABLE', 'Trusted persistence and verification boundaries are required');
  }

  let dispatched = false;
  const reviewed = await runGrokReview({ request, getCurrentHead, reviewClient: {
    async review(input) {
      if (dispatched) throw new Error('second reviewer dispatch forbidden');
      dispatched = true;
      if (await claimDispatch() !== true) throw new Error('durable dispatch claim unavailable');
      return reviewClient.review(input);
    },
  } });
  if (!reviewed.ok) return Object.freeze({ ...reviewed, nextAction: 'STOP_BLOCKED' });

  const persisted = await acknowledgeDurablePersistence(reviewed, {
    getCurrentHead,
    verifyPersistence: async (record) => {
      const receipt = await persistEvidence(Object.freeze({
        reviewer: 'Genesis Independent Grok Reviewer / Grok-xAI',
        repository: reviewed.repository,
        prNumber: reviewed.prNumber,
        reviewedHeadSha: reviewed.reviewedHeadSha,
        verdict: reviewed.verdict,
        headConfirmed: reviewed.headConfirmed,
        scope: reviewed.scope,
        findings: reviewed.findings.map((finding) => ({ ...finding })),
        readyGateSafe: reviewed.readyGateSafe,
        evidenceOnly: true,
        grantsAuthority: false,
      }));
      return verifyPersistence(record, receipt);
    },
  });

  if (!persisted.ok || persisted.consequentialGateEvidenceAvailable !== true) {
    return Object.freeze({ ...persisted, nextAction: 'STOP_BLOCKED' });
  }

  if (persisted.readyGateSafe !== 'YES' || !['APPROVE', 'APPROVE_WITH_FINDINGS'].includes(persisted.verdict)) {
    return Object.freeze({ ...persisted, nextAction: 'STOP_BLOCKED' });
  }

  return Object.freeze({ ...persisted, nextAction: 'NEXT_CEO_GATE' });
}

export const REVIEWER_ORCHESTRATOR_CAPABILITIES = Object.freeze({
  modelRequestsPerAuthorization: 1,
  automaticRetry: false,
  githubWriteByReviewer: Object.freeze([]),
  automaticConsequentialActions: Object.freeze([]),
});
