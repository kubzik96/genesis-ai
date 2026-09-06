/**
 * Genesis Secure GitHub Broker — Cloudflare Worker entry (S-0002).
 * Stage 2 production adapter source, default-off: no live deployment or secrets in repo.
 */
import { handleRequest } from './router.js';
import { authenticateService } from './auth.js';
import { matchRoute } from './allowlist.js';
import { createGithubClient } from './github-client.js';
import { requestHash } from './hash.js';
import { auditEvent } from './audit.js';
import {
  readJsonBodyBounded,
  validateReviewerRuntimeBody,
} from './reviewer-runtime.js';
import { BrokerDurableObject } from './durable-object.js';
import { DurableObjectProxyStore } from './do-proxy-store.js';

export { BrokerDurableObject };

const REVIEW_PATH = '/v1/reviews/grok';

function result(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export function isReviewerRuntimeRoute(request) {
  if (!request) return false;
  const url = new URL(request.url);
  return request.method.toUpperCase() === 'POST'
    && url.pathname === REVIEW_PATH
    && matchRoute('POST', REVIEW_PATH);
}

export async function handleReviewerRuntimeRequest(request, env = {}) {
  const tStart = Date.now();
  if (!isReviewerRuntimeRoute(request)) return result(404, { error: 'NOT_FOUND', message: 'Unknown endpoint or method' });

  const authn = authenticateService(request.headers.get('authorization'), env.BROKER_SERVICE_TOKEN);
  if (!authn.ok) {
    auditEvent({ endpoint: REVIEW_PATH, outcome: 'auth_failed', error: authn.error, latency_ms: Date.now() - tStart });
    return result(authn.status, { error: authn.error, message: authn.message });
  }
  if (!env.GITHUB_PAT || !env.store) {
    auditEvent({ endpoint: REVIEW_PATH, outcome: 503, error: 'REVIEW_DURABLE_BOUNDARY_UNAVAILABLE', latency_ms: Date.now() - tStart });
    return result(503, { error: 'REVIEW_GITHUB_UNAVAILABLE', message: 'Trusted GitHub boundary unavailable — fail-closed' });
  }

  const idemKey = request.headers.get('idempotency-key');
  if (!idemKey || idemKey.length > 200) {
    auditEvent({ endpoint: REVIEW_PATH, outcome: 400, error: 'MISSING_IDEMPOTENCY_KEY', latency_ms: Date.now() - tStart });
    return result(400, { error: 'MISSING_IDEMPOTENCY_KEY', message: 'Valid Idempotency-Key header required' });
  }
  const parsed = await readJsonBodyBounded(request);
  if (!parsed.ok) {
    auditEvent({ endpoint: REVIEW_PATH, outcome: parsed.status, error: parsed.body.error, idempotency_key: idemKey, latency_ms: Date.now() - tStart });
    return result(parsed.status, parsed.body);
  }
  const checked = validateReviewerRuntimeBody(parsed.value);
  if (!checked.ok) {
    auditEvent({ endpoint: REVIEW_PATH, outcome: checked.status, error: checked.body.error ?? checked.body.code, run_id: parsed.value?.run_id, idempotency_key: idemKey, latency_ms: Date.now() - tStart });
    return result(checked.status, checked.body);
  }
  const hash = await requestHash({
    op: 'review_grok',
    run_id: checked.value.runId,
    authorization: checked.value.authorization,
    context: checked.value.context,
  });
  let stored;
  try {
    stored = await env.store.executeReview({
      idempotencyKey: idemKey,
      requestHash: hash,
      runId: checked.value.runId,
      authorization: checked.value.authorization,
      context: checked.value.context,
    });
    if (!stored || !Number.isSafeInteger(stored.status) || !stored.body) throw new Error('invalid durable response');
  } catch {
    auditEvent({
      endpoint: REVIEW_PATH,
      outcome: 'unknown',
      error: 'REVIEW_DURABLE_BOUNDARY_UNAVAILABLE',
      run_id: checked.value.runId,
      idempotency_key: idemKey,
      github_status: null,
      idempotency_state: null,
      latency_ms: Date.now() - tStart,
    });
    return result(503, {
      error: 'REVIEW_DURABLE_BOUNDARY_UNAVAILABLE',
      message: 'Durable reviewer boundary unavailable; retry only with the same Idempotency-Key',
    });
  }
  auditEvent({
    endpoint: REVIEW_PATH,
    outcome: stored.replay ? 'replay' : stored.unknown ? 'unknown' : stored.status,
    error: stored.body?.error ?? stored.body?.code ?? null,
    run_id: checked.value.runId,
    idempotency_key: idemKey,
    github_status: stored.githubStatus ?? null,
    idempotency_state: stored.idempotencyState ?? null,
    latency_ms: Date.now() - tStart,
  });
  return result(stored.status, stored.body);
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
