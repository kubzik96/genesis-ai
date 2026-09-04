import { containsCredentialLikeValue } from './secret-scan.js';
import {
  GROK_REVIEWER_CONFIG,
  XAI_REVIEW_CONTEXT_BYTE_LIMIT,
  XAI_REVIEW_DIFF_BYTE_LIMIT,
} from './xai-review-contract.js';

const SHA = /^[a-f0-9]{40}$/i;
const VERDICTS = new Set(['APPROVE', 'APPROVE_WITH_FINDINGS', 'REQUEST_CHANGES', 'BLOCKED']);
const SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const DISPOSITIONS = new Set(['NON_BLOCKING', 'BLOCKING']);
const PRODUCERS = new Set(['CODEX', 'HUMAN', 'OTHER_AI']);
const OUTPUT_KEYS = new Set(['verdict', 'reviewed_head_sha', 'head_confirmed', 'scope', 'findings', 'ready_gate_safe']);
const FINDING_KEYS = new Set(['severity', 'disposition', 'evidence']);
const REQUEST_KEYS = new Set(['repository', 'prNumber', 'expectedHeadSha', 'diff', 'diffTruncated', 'changedFiles', 'context', 'contextTruncated', 'criteria', 'producer']);
const CHANGED_FILE_KEYS = new Set(['path', 'status']);
const MAX_FINDINGS = 100;
const MAX_EVIDENCE_LENGTH = 2000;
const bytes = (value) => new TextEncoder().encode(value).byteLength;
const codePoints = (value) => Array.from(value).length;
const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => Object.keys(value).every((key) => keys.has(key));

function blocked(code, message, reviewedHeadSha = null) {
  return Object.freeze({
    ok: false,
    code,
    message,
    verdict: 'BLOCKED',
    reviewedHeadSha,
    readyGateSafe: 'NO',
    consequentialGateEvidenceAvailable: false,
  });
}

export function validateReviewRequest(request) {
  if (!plainObject(request)) return blocked('INVALID_REQUEST', 'Review request must be an object');
  if (!onlyKeys(request, REQUEST_KEYS)) return blocked('REVIEW_AUTHORITY_EXPANSION', 'Review request contains an unsupported field');
  if (request.repository !== GROK_REVIEWER_CONFIG.repository) return blocked('REPOSITORY_MISMATCH', 'Repository is not allowed');
  if (!Number.isSafeInteger(request.prNumber) || request.prNumber < 1) return blocked('INVALID_PR_NUMBER', 'Positive PR number is required');
  if (typeof request.expectedHeadSha !== 'string' || !SHA.test(request.expectedHeadSha)) {
    return blocked('INVALID_EXPECTED_HEAD', 'Expected HEAD must be a 40-character SHA');
  }
  if (typeof request.diff !== 'string' || !request.diff || request.diffTruncated === true) {
    return blocked('INVALID_DIFF_CONTEXT', 'Complete non-empty bounded diff is required');
  }
  if (bytes(request.diff) > XAI_REVIEW_DIFF_BYTE_LIMIT) return blocked('DIFF_TOO_LARGE', 'Diff exceeds byte ceiling');
  if (!Array.isArray(request.changedFiles) || request.changedFiles.length === 0) {
    return blocked('INVALID_CHANGED_FILES', 'Changed-file metadata is required');
  }
  if (request.changedFiles.some((file) => !plainObject(file) || !onlyKeys(file, CHANGED_FILE_KEYS)
    || typeof file.path !== 'string' || !file.path.trim() || typeof file.status !== 'string' || !file.status.trim())) {
    return blocked('INVALID_CHANGED_FILES', 'Changed-file metadata is malformed');
  }
  if (typeof request.context !== 'string' || !request.context || request.contextTruncated === true) {
    return blocked('INVALID_REVIEW_CONTEXT', 'Complete non-empty bounded canonical context is required');
  }
  if (bytes(request.context) > XAI_REVIEW_CONTEXT_BYTE_LIMIT) return blocked('CONTEXT_TOO_LARGE', 'Context exceeds byte ceiling');
  if (!Array.isArray(request.criteria) || request.criteria.length === 0 || request.criteria.some((v) => typeof v !== 'string' || !v.trim())) {
    return blocked('INVALID_CRITERIA', 'Explicit review criteria are required');
  }
  if (typeof request.producer !== 'string' || !PRODUCERS.has(request.producer)) {
    return blocked('INVALID_PRODUCER', 'Producer identity must be a canonical trusted-orchestrator value');
  }
  if (containsCredentialLikeValue(JSON.stringify(request))) return blocked('SECRET_INPUT_REJECTED', 'Credential-like reviewer input is forbidden');
  return { ok: true, value: { ...request, expectedHeadSha: request.expectedHeadSha.toLowerCase() } };
}

export function validateReviewOutput(output, expectedHeadSha) {
  if (!plainObject(output) || !onlyKeys(output, OUTPUT_KEYS) || Object.keys(output).length !== OUTPUT_KEYS.size) {
    return blocked('MALFORMED_OUTPUT', 'Reviewer output does not match the closed contract');
  }
  if (containsCredentialLikeValue(JSON.stringify(output))) return blocked('SECRET_OUTPUT_REJECTED', 'Credential-like reviewer output is forbidden');
  if (!VERDICTS.has(output.verdict) || !SHA.test(output.reviewed_head_sha || '') || !['YES', 'NO'].includes(output.head_confirmed)
    || !['CLEAN', 'NOT_CLEAN'].includes(output.scope) || !Array.isArray(output.findings)
    || output.findings.length > MAX_FINDINGS || !['YES', 'NO'].includes(output.ready_gate_safe)) {
    return blocked('MALFORMED_OUTPUT', 'Reviewer output contains missing, unknown, or out-of-bounds values');
  }
  const reviewedHeadSha = output.reviewed_head_sha.toLowerCase();
  if (reviewedHeadSha !== expectedHeadSha.toLowerCase()) return blocked('REVIEWED_HEAD_MISMATCH', 'Reviewed HEAD differs from expected HEAD', reviewedHeadSha);
  for (const finding of output.findings) {
    if (!plainObject(finding) || !onlyKeys(finding, FINDING_KEYS) || Object.keys(finding).length !== FINDING_KEYS.size
      || !SEVERITIES.has(finding.severity) || !DISPOSITIONS.has(finding.disposition)
      || typeof finding.evidence !== 'string' || !finding.evidence.trim() || codePoints(finding.evidence) > MAX_EVIDENCE_LENGTH) {
      return blocked('MALFORMED_FINDING', 'Every finding requires bounded evidence and known severity/disposition', reviewedHeadSha);
    }
    if (['HIGH', 'CRITICAL'].includes(finding.severity) && finding.disposition !== 'BLOCKING') {
      return blocked('CONTRADICTORY_OUTPUT', 'HIGH and CRITICAL findings must be blocking', reviewedHeadSha);
    }
  }
  const blocking = output.findings.some((finding) => finding.disposition === 'BLOCKING');
  const positive = ['APPROVE', 'APPROVE_WITH_FINDINGS'].includes(output.verdict);
  const contradiction = (output.head_confirmed === 'NO' && output.verdict !== 'BLOCKED')
    || (output.scope === 'NOT_CLEAN' && output.verdict !== 'BLOCKED')
    || ((output.head_confirmed === 'NO' || output.scope === 'NOT_CLEAN') && output.ready_gate_safe !== 'NO')
    || (blocking && (!['REQUEST_CHANGES', 'BLOCKED'].includes(output.verdict) || output.ready_gate_safe !== 'NO'))
    || (['REQUEST_CHANGES', 'BLOCKED'].includes(output.verdict) && output.ready_gate_safe !== 'NO')
    || (output.verdict === 'APPROVE' && output.findings.length !== 0)
    || (output.verdict === 'APPROVE_WITH_FINDINGS' && (output.findings.length === 0 || blocking))
    || (output.ready_gate_safe === 'YES' && (output.head_confirmed !== 'YES' || output.scope !== 'CLEAN' || blocking || !positive));
  if (contradiction) return blocked('CONTRADICTORY_OUTPUT', 'Reviewer output violates cross-field invariants', reviewedHeadSha);
  return {
    ok: true,
    verdict: output.verdict,
    reviewedHeadSha,
    headConfirmed: output.head_confirmed,
    scope: output.scope,
    findings: output.findings.map((finding) => ({ ...finding })),
    readyGateSafe: output.ready_gate_safe,
    consequentialGateEvidenceAvailable: false,
  };
}

export async function runGrokReview({ request, getCurrentHead, reviewClient }) {
  const validRequest = validateReviewRequest(request);
  if (!validRequest.ok) return validRequest;
  if (typeof getCurrentHead !== 'function' || typeof reviewClient?.review !== 'function') {
    return blocked('REVIEW_BOUNDARY_UNAVAILABLE', 'Required read or reviewer boundary is unavailable');
  }
  const expected = validRequest.value.expectedHeadSha;
  let requestHead;
  try { requestHead = await getCurrentHead(request.repository, request.prNumber); } catch { return blocked('HEAD_READ_FAILED', 'Could not verify request-time HEAD'); }
  if (typeof requestHead !== 'string' || requestHead.toLowerCase() !== expected) return blocked('REQUEST_HEAD_MISMATCH', 'Request-time HEAD differs from expected HEAD');
  let output;
  try { output = await reviewClient.review(validRequest.value); } catch { return blocked('REVIEW_API_FAILED', 'Reviewer API or model output failed'); }
  const validated = validateReviewOutput(output, expected);
  if (!validated.ok) return validated;
  let acceptanceHead;
  try { acceptanceHead = await getCurrentHead(request.repository, request.prNumber); } catch { return blocked('HEAD_READ_FAILED', 'Could not verify acceptance-time HEAD', validated.reviewedHeadSha); }
  if (typeof acceptanceHead !== 'string' || acceptanceHead.toLowerCase() !== expected) {
    return blocked('ACCEPTANCE_HEAD_MISMATCH', 'Acceptance-time HEAD differs from reviewed HEAD', validated.reviewedHeadSha);
  }
  return Object.freeze({ ...validated, repository: request.repository, prNumber: request.prNumber });
}

export async function acknowledgeDurablePersistence(result, { getCurrentHead, verifyPersistence } = {}) {
  if (!result?.ok) return blocked('INVALID_REVIEW_RESULT', 'Only a validated review result can be persisted');
  if (typeof getCurrentHead !== 'function' || typeof verifyPersistence !== 'function') {
    return blocked('PERSISTENCE_BOUNDARY_UNAVAILABLE', 'Trusted HEAD and persistence verification boundaries are required', result.reviewedHeadSha);
  }
  if (typeof result.reviewedHeadSha !== 'string' || !SHA.test(result.reviewedHeadSha)) {
    return blocked('PERSISTENCE_NOT_CONFIRMED', 'Reviewed HEAD is malformed', null);
  }
  let currentHead;
  try { currentHead = await getCurrentHead(result.repository, result.prNumber); } catch {
    return blocked('HEAD_READ_FAILED', 'Could not verify HEAD immediately before persistence', result.reviewedHeadSha);
  }
  if (typeof currentHead !== 'string' || !SHA.test(currentHead) || currentHead.toLowerCase() !== result.reviewedHeadSha.toLowerCase()) {
    return blocked('PERSISTENCE_HEAD_MISMATCH', 'Current PR HEAD differs from reviewed HEAD immediately before persistence', result.reviewedHeadSha);
  }
  let persisted;
  try {
    persisted = await verifyPersistence(Object.freeze({
      repository: result.repository,
      prNumber: result.prNumber,
      reviewedHeadSha: result.reviewedHeadSha,
      verdict: result.verdict,
    }));
  } catch {
    return blocked('PERSISTENCE_NOT_CONFIRMED', 'Trusted persistence verification failed', result.reviewedHeadSha);
  }
  if (persisted !== true) {
    return blocked('PERSISTENCE_NOT_CONFIRMED', 'Trusted persistence boundary did not confirm exact-HEAD durability', result.reviewedHeadSha);
  }
  return Object.freeze({ ...result, consequentialGateEvidenceAvailable: true });
}

export const GROK_REVIEWER_CAPABILITIES = Object.freeze({ githubRead: true, githubWrite: Object.freeze([]) });
