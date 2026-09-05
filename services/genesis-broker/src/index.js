/**
 * Genesis Secure GitHub Broker — Cloudflare Worker entry (S-0002).
 * Stage 2 production adapter source, default-off: no live deployment or secrets in repo.
 */
import { handleRequest } from './router.js';
import { authenticateService } from './auth.js';
import { matchRoute } from './allowlist.js';
import { FIXED_FULL_NAME } from './constants.js';
import { createGithubClient, parseLinkNext } from './github-client.js';
import { containsCredentialLikeValue } from './secret-scan.js';
import { orchestrateIndependentReview, validateReviewerAuthorization } from './reviewer-orchestrator.js';
import { createProductionXaiReviewClient } from './xai-review-client.js';
import { BrokerDurableObject } from './durable-object.js';
import { DurableObjectProxyStore } from './do-proxy-store.js';

export { BrokerDurableObject };

const REVIEW_PATH = '/v1/reviews/grok';
const EVIDENCE_PREFIX = 'GENESIS_REVIEW_EVIDENCE_V1 ';
const BODY_KEYS = new Set(['authorization', 'context']);
const SHA = /^[a-f0-9]{40}$/i;

function result(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

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

function normalizeReviewResult(review) {
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

function evidenceBody(record) {
  return `${EVIDENCE_PREFIX}${JSON.stringify({
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
  })}`;
}

function parseEvidenceBody(body) {
  if (typeof body !== 'string' || !body.startsWith(EVIDENCE_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(EVIDENCE_PREFIX.length));
  } catch {
    return null;
  }
}

export function isReviewerRuntimeRoute(request) {
  if (!request) return false;
  const url = new URL(request.url);
  return request.method.toUpperCase() === 'POST'
    && url.pathname === REVIEW_PATH
    && matchRoute('POST', REVIEW_PATH);
}

export async function handleReviewerRuntimeRequest(request, env = {}) {
  if (!isReviewerRuntimeRoute(request)) return result(404, { error: 'NOT_FOUND', message: 'Unknown endpoint or method' });

  const authn = authenticateService(request.headers.get('authorization'), env.BROKER_SERVICE_TOKEN);
  if (!authn.ok) return result(authn.status, { error: authn.error, message: authn.message });
  if (!env.GITHUB_PAT || !env.github) {
    return result(503, { error: 'REVIEW_GITHUB_UNAVAILABLE', message: 'Trusted GitHub boundary unavailable — fail-closed' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return result(400, { error: 'INVALID_JSON', message: 'Body must be JSON' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== BODY_KEYS.size
    || !Object.keys(body).every((key) => BODY_KEYS.has(key))) {
    return result(400, { error: 'REVIEW_BODY_MALFORMED', message: 'Review body must contain only authorization and context' });
  }
  const authorization = body.authorization;
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) {
    return result(409, normalizeReviewResult(blocked('REVIEW_AUTH_MISSING', 'Bounded reviewer authorization is required')));
  }
  if (authorization.repository !== FIXED_FULL_NAME) {
    return result(409, normalizeReviewResult(blocked('REVIEW_AUTH_REPOSITORY_MISMATCH', 'Only the fixed Genesis repository is allowed')));
  }
  if (typeof body.context !== 'string' || !body.context.trim()) {
    return result(409, normalizeReviewResult(blocked('INVALID_REVIEW_CONTEXT', 'Bounded canonical review context is required')));
  }
  if (containsCredentialLikeValue(JSON.stringify(body))) {
    return result(409, normalizeReviewResult(blocked('REVIEW_SECRET_INPUT_REJECTED', 'Credential-like reviewer input is forbidden')));
  }

  const authProbe = validateReviewerAuthorization(authorization, {
    repository: authorization.repository,
    prNumber: authorization.prNumber,
    expectedHeadSha: authorization.expectedHeadSha,
    criteria: authorization.criteria,
    producer: authorization.artifactProducer,
  });
  if (!authProbe.ok) return result(409, normalizeReviewResult(authProbe));

  const github = env.github;
  const initialPull = await github.getPull(authorization.prNumber);
  if (!initialPull?.ok || typeof initialPull.data?.head?.sha !== 'string') {
    return result(409, normalizeReviewResult(blocked('HEAD_READ_FAILED', 'Could not verify initial PR HEAD')));
  }
  const initialHead = initialPull.data.head.sha.toLowerCase();
  const expected = authorization.expectedHeadSha.toLowerCase();
  if (!SHA.test(initialHead) || initialHead !== expected) {
    return result(409, normalizeReviewResult(blocked('REQUEST_HEAD_MISMATCH', 'Initial PR HEAD differs from expected HEAD')));
  }

  const filesResponse = await github.getPullFiles(authorization.prNumber);
  if (!filesResponse?.ok || !Array.isArray(filesResponse.data) || parseLinkNext(filesResponse.headers)) {
    return result(409, normalizeReviewResult(blocked('REVIEW_FILES_INCOMPLETE', 'Complete changed-file metadata is unavailable')));
  }
  const changedFiles = filesResponse.data.map((file) => ({ path: file?.filename, status: file?.status }));

  const diffResponse = await github.getPullDiff(authorization.prNumber);
  if (!diffResponse?.ok || typeof diffResponse.data !== 'string' || !diffResponse.data) {
    return result(409, normalizeReviewResult(blocked('INVALID_DIFF_CONTEXT', 'Complete unified diff is unavailable')));
  }

  const reviewRequest = Object.freeze({
    repository: FIXED_FULL_NAME,
    prNumber: authorization.prNumber,
    expectedHeadSha: expected,
    diff: diffResponse.data,
    diffTruncated: false,
    changedFiles,
    context: body.context,
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

  const reviewClient = env.reviewClient || createProductionXaiReviewClient({
    productionEnabled: env.XAI_REVIEWER_LIVE_ENABLED === 'true',
    xaiApiKey: env.XAI_API_KEY,
    fetchImpl: env.xaiFetch || globalThis.fetch,
  });

  const persistEvidence = async (record) => {
    const written = await github.addIssueComment(record.prNumber, evidenceBody(record));
    const id = written?.data?.id;
    if (!written?.ok || !Number.isSafeInteger(id) || id < 1) throw new Error('review evidence write failed');
    return Object.freeze({ id, prNumber: record.prNumber, reviewedHeadSha: record.reviewedHeadSha, verdict: record.verdict });
  };

  const verifyPersistence = async (record, receipt) => {
    if (!Number.isSafeInteger(receipt?.id) || receipt.prNumber !== record.prNumber
      || receipt.reviewedHeadSha !== record.reviewedHeadSha || receipt.verdict !== record.verdict) return false;
    const readBack = await github.getIssueComment(receipt.id);
    if (!readBack?.ok) return false;
    const expectedIssueUrl = `https://api.github.com/repos/kubzik96/genesis-ai/issues/${record.prNumber}`;
    if (readBack.data?.issue_url !== expectedIssueUrl) return false;
    const parsed = parseEvidenceBody(readBack.data?.body);
    return parsed?.repository === record.repository
      && parsed?.pr_number === record.prNumber
      && parsed?.reviewed_head_sha === record.reviewedHeadSha
      && parsed?.verdict === record.verdict
      && parsed?.evidence_only === true
      && parsed?.grants_authority === false;
  };

  const review = await orchestrateIndependentReview({
    authorization,
    request: reviewRequest,
    getCurrentHead,
    reviewClient,
    persistEvidence,
    verifyPersistence,
  });
  return result(review.ok ? 200 : 409, normalizeReviewResult(review));
}

export default {
  async fetch(request, env, ctx) {
    const runtimeEnv = { ...env };
    if (env.BROKER_DO) {
      // Production: all writes go through the single DO instance for kubzik96/genesis-ai.
      // MemoryBrokerStore is never used in this path.
      const id = env.BROKER_DO.idFromName('kubzik96/genesis-ai');
      const stub = env.BROKER_DO.get(id);
      runtimeEnv.store = new DurableObjectProxyStore(stub);
    }
    if (!runtimeEnv.github && env.GITHUB_PAT) {
      runtimeEnv.github = createGithubClient({ pat: env.GITHUB_PAT });
    }

    const resultValue = isReviewerRuntimeRoute(request)
      ? await handleReviewerRuntimeRequest(request, runtimeEnv)
      : await handleRequest(request, runtimeEnv);
    return new Response(resultValue.body, {
      status: resultValue.status,
      headers: resultValue.headers,
    });
  },
};
