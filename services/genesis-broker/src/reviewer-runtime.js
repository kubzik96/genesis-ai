import { FIXED_FULL_NAME } from './constants.js';
import { parseLinkNext } from './github-client.js';
import { orchestrateIndependentReview, validateReviewerAuthorization } from './reviewer-orchestrator.js';
import { containsCredentialLikeValue } from './secret-scan.js';
import {
  XAI_REVIEW_CONTEXT_BYTE_LIMIT,
  XAI_REVIEW_DIFF_BYTE_LIMIT,
  XAI_REVIEW_REQUEST_BYTE_LIMIT,
} from './xai-review-contract.js';

const SHA = /^[a-f0-9]{40}$/i;
const RUN_ID = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const BODY_KEYS = new Set(['authorization', 'context', 'run_id']);
const EVIDENCE_PREFIX = 'GENESIS_REVIEW_EVIDENCE_V2 ';
const bytes = (value) => new TextEncoder().encode(value).byteLength;

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

export function normalizeReviewResult(review) {
  return {
    ok: review?.ok === true,
    code: review?.code ?? null,
    verdict: review?.verdict ?? 'BLOCKED',
    reviewed_head_sha: review?.reviewedHeadSha ?? null,
    head_confirmed: review?.headConfirmed ?? (review?.ok ? 'YES' : 'NO'),
    scope: review?.scope ?? (review?.ok ? 'CLEAN' : 'NOT_CLEAN'),
    findings: Array.isArray(review?.findings) ? review.findings : [],
    ready_gate_safe: review?.readyGateSafe ?? 'NO',
    consequential_gate_evidence_available: review?.consequentialGateEvidenceAvailable === true,
    next_action: review?.nextAction ?? 'STOP_BLOCKED',
  };
}

export function validateReviewerRuntimeBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== BODY_KEYS.size
    || !Object.keys(body).every((key) => BODY_KEYS.has(key))) {
    return { ok: false, status: 400, body: { error: 'REVIEW_BODY_MALFORMED', message: 'Review body must contain only authorization, context, and run_id' } };
  }
  if (typeof body.run_id !== 'string' || !RUN_ID.test(body.run_id)) {
    return { ok: false, status: 400, body: { error: 'INVALID_RUN_ID', message: 'run_id must match ^[a-z0-9][a-z0-9._-]{0,80}$' } };
  }
  if (typeof body.context !== 'string' || !body.context.trim()) {
    return { ok: false, status: 409, body: normalizeReviewResult(blocked('INVALID_REVIEW_CONTEXT', 'Bounded canonical review context is required')) };
  }
  if (bytes(body.context) > XAI_REVIEW_CONTEXT_BYTE_LIMIT) {
    return { ok: false, status: 413, body: normalizeReviewResult(blocked('CONTEXT_TOO_LARGE', 'Context exceeds byte ceiling')) };
  }
  if (containsCredentialLikeValue(JSON.stringify(body))) {
    return { ok: false, status: 409, body: normalizeReviewResult(blocked('REVIEW_SECRET_INPUT_REJECTED', 'Credential-like reviewer input is forbidden')) };
  }
  const authorization = body.authorization;
  const authProbe = validateReviewerAuthorization(authorization, {
    repository: authorization?.repository,
    prNumber: authorization?.prNumber,
    expectedHeadSha: authorization?.expectedHeadSha,
    criteria: authorization?.criteria,
    producer: authorization?.artifactProducer,
  });
  if (!authProbe.ok) return { ok: false, status: 409, body: normalizeReviewResult(authProbe) };
  if (authorization.repository !== FIXED_FULL_NAME) {
    return { ok: false, status: 409, body: normalizeReviewResult(blocked('REVIEW_AUTH_REPOSITORY_MISMATCH', 'Only the fixed Genesis repository is allowed')) };
  }
  return {
    ok: true,
    value: Object.freeze({
      authorization: authProbe.value,
      context: body.context,
      runId: body.run_id,
    }),
  };
}

export async function readJsonBodyBounded(request, byteLimit = XAI_REVIEW_REQUEST_BYTE_LIMIT) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > byteLimit) {
    return { ok: false, status: 413, body: { error: 'REVIEW_REQUEST_TOO_LARGE', message: 'Review request exceeds byte ceiling' } };
  }
  const reader = request.body?.getReader?.();
  if (!reader) {
    return { ok: false, status: 400, body: { error: 'INVALID_JSON', message: 'Body must be JSON' } };
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > byteLimit) {
        await reader.cancel();
        return { ok: false, status: 413, body: { error: 'REVIEW_REQUEST_TOO_LARGE', message: 'Review request exceeds byte ceiling' } };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, body: { error: 'INVALID_JSON', message: 'Body must be valid JSON' } };
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) };
  } catch {
    return { ok: false, status: 400, body: { error: 'INVALID_JSON', message: 'Body must be valid UTF-8 JSON' } };
  }
}

function evidenceRecord(record, binding) {
  return {
    envelope_version: 2,
    ...binding,
    reviewer: record.reviewer,
    repository: record.repository,
    pr_number: record.prNumber,
    reviewed_head_sha: record.reviewedHeadSha,
    verdict: record.verdict,
    head_confirmed: record.headConfirmed,
    scope: record.scope,
    findings: record.findings,
    ready_gate_safe: record.readyGateSafe,
    evidence_only: true,
    grants_authority: false,
  };
}

function evidenceBody(record, binding) {
  return `${EVIDENCE_PREFIX}${JSON.stringify(evidenceRecord(record, binding))}`;
}

function parseEvidenceBody(body) {
  if (typeof body !== 'string' || !body.startsWith(EVIDENCE_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(EVIDENCE_PREFIX.length));
  } catch {
    return null;
  }
}

function sameEvidence(parsed, expected) {
  return parsed?.envelope_version === 2
    && parsed?.grantId === expected.grantId
    && parsed?.manifestHash === expected.manifestHash
    && parsed?.request_hash === expected.request_hash
    && parsed?.run_id === expected.run_id
    && parsed?.reviewer === expected.reviewer
    && parsed?.repository === expected.repository
    && parsed?.pr_number === expected.pr_number
    && parsed?.reviewed_head_sha === expected.reviewed_head_sha
    && parsed?.verdict === expected.verdict
    && parsed?.head_confirmed === expected.head_confirmed
    && parsed?.scope === expected.scope
    && JSON.stringify(parsed?.findings) === JSON.stringify(expected.findings)
    && parsed?.ready_gate_safe === expected.ready_gate_safe
    && parsed?.evidence_only === true
    && parsed?.grants_authority === false;
}

export async function executeReviewerRuntimeOperation({ authorization, context, github, reviewClient, claimDispatch, executionIdentity } = {}) {
  const preflight = validateReviewerRuntimeBody({ authorization, context, run_id: 'internal' });
  if (!preflight.ok) return { status: preflight.status, body: preflight.body };
  if (!authorization.grantId || typeof claimDispatch !== 'function'
    || !RUN_ID.test(executionIdentity?.run_id ?? '')
    || typeof executionIdentity?.request_hash !== 'string' || !executionIdentity.request_hash) {
    return { status: 409, body: normalizeReviewResult(blocked('REVIEW_GRANT_REQUIRED', 'Durable grant and execution identity are required')) };
  }
  const binding = Object.freeze({ grantId: authorization.grantId, manifestHash: authorization.manifestHash,
    request_hash: executionIdentity.request_hash, run_id: executionIdentity.run_id });
  let evidenceReceipt = null;
  if (!github || typeof github.getPull !== 'function' || typeof github.getPullFiles !== 'function'
    || typeof github.getPullDiff !== 'function' || typeof github.addIssueComment !== 'function'
    || typeof github.getIssueComment !== 'function') {
    return { status: 503, body: { error: 'REVIEW_GITHUB_UNAVAILABLE', message: 'Trusted GitHub boundary unavailable — fail-closed' } };
  }

  let initialPull;
  try { initialPull = await github.getPull(authorization.prNumber); } catch {
    return { status: 409, body: normalizeReviewResult(blocked('HEAD_READ_FAILED', 'Could not verify initial PR HEAD')) };
  }
  if (!initialPull?.ok || typeof initialPull.data?.head?.sha !== 'string') {
    return { status: 409, body: normalizeReviewResult(blocked('HEAD_READ_FAILED', 'Could not verify initial PR HEAD')) };
  }
  const initialHead = initialPull.data.head.sha.toLowerCase();
  const expected = authorization.expectedHeadSha.toLowerCase();
  if (!SHA.test(initialHead) || initialHead !== expected) {
    return { status: 409, body: normalizeReviewResult(blocked('REQUEST_HEAD_MISMATCH', 'Initial PR HEAD differs from expected HEAD')) };
  }

  let filesResponse;
  try { filesResponse = await github.getPullFiles(authorization.prNumber); } catch {
    return { status: 409, body: normalizeReviewResult(blocked('REVIEW_FILES_READ_FAILED', 'Changed-file metadata is unavailable')) };
  }
  if (!filesResponse?.ok || !Array.isArray(filesResponse.data) || parseLinkNext(filesResponse.headers)) {
    return { status: 409, body: normalizeReviewResult(blocked('REVIEW_FILES_INCOMPLETE', 'Complete changed-file metadata is unavailable')) };
  }
  const changedFiles = filesResponse.data.map((file) => ({ path: file?.filename, status: file?.status }));

  let diffResponse;
  try { diffResponse = await github.getPullDiff(authorization.prNumber, XAI_REVIEW_DIFF_BYTE_LIMIT); } catch {
    return { status: 409, body: normalizeReviewResult(blocked('INVALID_DIFF_CONTEXT', 'Complete unified diff is unavailable')) };
  }
  if (diffResponse?.tooLarge === true) {
    return { status: 413, body: normalizeReviewResult(blocked('DIFF_TOO_LARGE', 'Diff exceeds byte ceiling')) };
  }
  if (!diffResponse?.ok || typeof diffResponse.data !== 'string' || !diffResponse.data) {
    return { status: 409, body: normalizeReviewResult(blocked('INVALID_DIFF_CONTEXT', 'Complete unified diff is unavailable')) };
  }

  const reviewRequest = Object.freeze({
    repository: FIXED_FULL_NAME,
    prNumber: authorization.prNumber,
    expectedHeadSha: expected,
    diff: diffResponse.data,
    diffTruncated: false,
    changedFiles,
    context,
    contextTruncated: false,
    criteria: [...authorization.criteria],
    producer: authorization.artifactProducer,
  });
  const getCurrentHead = async (repository, prNumber) => {
    if (repository !== FIXED_FULL_NAME || prNumber !== authorization.prNumber) throw new Error('review target changed');
    const current = await github.getPull(prNumber);
    const sha = current?.data?.head?.sha;
    if (!current?.ok || typeof sha !== 'string' || !SHA.test(sha)) throw new Error('HEAD unavailable');
    return sha.toLowerCase();
  };
  const persistEvidence = async (record) => {
    const body = evidenceBody(record, binding);
    const written = await github.addIssueComment(record.prNumber, body);
    const id = written?.data?.id;
    if (!written?.ok || !Number.isSafeInteger(id) || id < 1) throw new Error('review evidence write failed');
    evidenceReceipt = Object.freeze({ comment_id: id, repository: record.repository, pr_number: record.prNumber,
      reviewed_head_sha: record.reviewedHeadSha, ...binding, read_back_verified: false });
    return Object.freeze({ id, expected: evidenceRecord(record, binding) });
  };
  const verifyPersistence = async (record, receipt) => {
    if (!Number.isSafeInteger(receipt?.id) || receipt?.expected?.repository !== record.repository
      || receipt.expected.pr_number !== record.prNumber || receipt.expected.reviewed_head_sha !== record.reviewedHeadSha
      || receipt.expected.verdict !== record.verdict) return false;
    const readBack = await github.getIssueComment(receipt.id);
    if (readBack?.ok !== true || readBack.status !== 200 || readBack.data?.id !== receipt.id) return false;
    const expectedIssueUrl = `https://api.github.com/repos/kubzik96/genesis-ai/issues/${record.prNumber}`;
    if (readBack.data?.issue_url !== expectedIssueUrl) return false;
    const matches = readBack.data?.body === EVIDENCE_PREFIX + JSON.stringify(receipt.expected)
      && sameEvidence(parseEvidenceBody(readBack.data?.body), receipt.expected);
    if (matches) evidenceReceipt = Object.freeze({ ...evidenceReceipt, read_back_verified: true });
    return matches;
  };

  const review = await orchestrateIndependentReview({
    authorization,
    request: reviewRequest,
    getCurrentHead,
    reviewClient,
    persistEvidence,
    verifyPersistence,
    claimDispatch,
  });
  return { status: review.ok ? 200 : 409, body: normalizeReviewResult(review), evidenceReceipt };
}
