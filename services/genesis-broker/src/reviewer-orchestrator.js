import { acknowledgeDurablePersistence, runGrokReview } from './grok-reviewer.js';
import { containsCredentialLikeValue } from './secret-scan.js';

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
  if (!Object.keys(authorization).every((key) => AUTH_KEYS.has(key)) || Object.keys(authorization).length !== AUTH_KEYS.size) {
    return blocked('REVIEW_AUTH_MALFORMED', 'Reviewer authorization must use the closed S-0010 authorization shape');
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

export async function orchestrateIndependentReview({
  authorization,
  request,
  getCurrentHead,
  reviewClient,
  persistEvidence,
  verifyPersistence,
} = {}) {
  const validAuthorization = validateReviewerAuthorization(authorization, request);
  if (!validAuthorization.ok) return validAuthorization;
  if (typeof getCurrentHead !== 'function' || typeof reviewClient?.review !== 'function') {
    return blocked('REVIEW_BOUNDARY_UNAVAILABLE', 'Trusted HEAD read and reviewer boundaries are required');
  }
  if (typeof persistEvidence !== 'function' || typeof verifyPersistence !== 'function') {
    return blocked('PERSISTENCE_BOUNDARY_UNAVAILABLE', 'Trusted persistence and verification boundaries are required');
  }

  const reviewed = await runGrokReview({ request, getCurrentHead, reviewClient });
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
