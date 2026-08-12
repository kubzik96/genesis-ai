/**
 * Request router for Genesis Broker Worker.
 * Fail-closed: unknown routes → 404; missing auth/gate → 401/403.
 */

import { isAllowedRoute } from './allowlist.js';
import { OP_GROK_DRAFT_PR, GATES } from './constants.js';
import { validateGrokDraftPrRequest } from './grok-validate.js';
import { executeGrokDraftPr } from './grok-draft-pr.js';
import { createGitHubClient } from './github-client.js';
import { createXaiClient } from './xai-client.js';
import { createMemoryStore } from './memory-store.js';

/**
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 */
export async function handleRequest(request, env, ctx = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname;

  if (!isAllowedRoute(method, pathname)) {
    return json({ error: 'not_found' }, 404);
  }

  // Health is open
  if (method === 'GET' && pathname === '/v1/health') {
    return json({ ok: true, stage: 'CODE_AND_TESTS_ONLY' });
  }

  // Auth (Bearer)
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token && pathname !== '/v1/health') {
    return json({ error: 'unauthorized' }, 401);
  }

  // Dispatch
  if (method === 'POST' && pathname === '/v1/executions/grok/draft-pr') {
    return handleGrokDraftPr(request, env, token);
  }

  // Other endpoints omitted for Stage 1 focus (existing handlers remain in full codebase)
  return json({ error: 'not_implemented_in_stage1_slice' }, 501);
}

async function handleGrokDraftPr(request, env, token) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const v = validateGrokDraftPrRequest(body);
  if (!v.ok) {
    return json({ error: 'validation_failed', details: v.errors }, 400);
  }

  // Gate check (simplified; production uses validateGate)
  if (env.REQUIRE_GATE === '1' && body.gate !== GATES.GROK_DRAFT_PR) {
    return json({ error: 'gate_denied', required: GATES.GROK_DRAFT_PR }, 403);
  }

  const requestHash =
    request.headers.get('Idempotency-Key') ||
    body.request_hash ||
    `auto:${body.run_id}:${body.branch_name}`;

  const github = createGitHubClient({
    token: env.GITHUB_TOKEN || token,
    owner: env.REPO_OWNER || 'kubzik96',
    repo: env.REPO_NAME || 'genesis-ai',
  });
  const xai = createXaiClient({ apiKey: env.XAI_API_KEY, mock: env.XAI_MOCK === '1' });
  const store = createMemoryStore(env);

  const result = await executeGrokDraftPr(
    { requestHash },
    { ...body, request_hash: requestHash },
    { github, xai, store }
  );

  if (result.ok === false) {
    return json(result, result.status || 500);
  }
  return json(result, 200);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
