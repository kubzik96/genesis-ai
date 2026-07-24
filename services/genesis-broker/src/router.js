import { authenticateService } from './auth.js';
import { validateGate } from './gate.js';
import { isAllowedContextPath, matchRoute } from './allowlist.js';
import { requestHash } from './hash.js';
import { GATES, FIXED_FULL_NAME, FIXED_BASE_BRANCH } from './constants.js';
import { mapGithubError } from './github-client.js';
import { assertAssignIssueBelongsToRun } from './memory-store.js';
import { auditEvent } from './audit.js';

function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

/**
 * Pure request handler — env provides secrets and store/github.
 * No merge/push/delete routes exist.
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;

  if (!matchRoute(method, path)) {
    return json(404, { error: 'NOT_FOUND', message: 'Unknown endpoint or method' });
  }

  if (method === 'GET' && path === '/v1/health') {
    const patOk = Boolean(env.GITHUB_PAT);
    const doOk = Boolean(env.store || env.BROKER_DO);
    const blocked = !patOk || !doOk;
    const body = {
      status: blocked ? 'BLOCKED' : 'ok',
      repository: FIXED_FULL_NAME,
      base_branch: FIXED_BASE_BRANCH,
      pat_configured: patOk,
      durable_object_configured: doOk,
      kv_used: false,
    };
    auditEvent({ endpoint: '/v1/health', outcome: body.status });
    return json(blocked ? 503 : 200, body);
  }

  const auth = authenticateService(request.headers.get('authorization'), env.BROKER_SERVICE_TOKEN);
  if (!auth.ok) {
    auditEvent({ endpoint: path, outcome: 'auth_failed', error: auth.error });
    return json(auth.status, { error: auth.error, message: auth.message });
  }

  if (!env.GITHUB_PAT) {
    return json(503, { error: 'PAT_NOT_CONFIGURED', message: 'GITHUB_PAT missing — fail-closed' });
  }
  if (!env.store && !env.BROKER_DO) {
    return json(503, {
      error: 'DURABLE_OBJECT_NOT_CONFIGURED',
      message: 'Durable Object binding missing — write endpoints BLOCKED',
    });
  }

  const github = env.github;

  if (method === 'POST' && path === '/v1/context/read') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'INVALID_JSON', message: 'Body must be JSON' });
    }
    const filePath = body?.path;
    if (!isAllowedContextPath(filePath)) {
      auditEvent({ endpoint: path, outcome: 'path_denied', path: filePath });
      return json(403, { error: 'PATH_NOT_ALLOWED', message: 'Context path outside allowlist' });
    }
    const res = await github.getContent(filePath.replace(/^\/+/, ''));
    if (!res.ok) {
      const mapped = mapGithubError(res.status, res.data);
      return json(mapped.status, mapped);
    }
    let content = res.data?.content || '';
    if (res.data?.encoding === 'base64') {
      content = atob(content.replace(/\n/g, ''));
    }
    auditEvent({ endpoint: path, outcome: 'ok', path: filePath });
    return json(200, {
      path: filePath.replace(/^\/+/, ''),
      sha: res.data?.sha,
      content,
      repository: FIXED_FULL_NAME,
      ref: FIXED_BASE_BRANCH,
    });
  }

  if (method === 'POST' && path === '/v1/issues') {
    return handleCreateIssue(request, env, github);
  }

  const assignMatch = path.match(/^\/v1\/issues\/(\d+)\/assign-copilot$/);
  if (method === 'POST' && assignMatch) {
    return handleAssign(request, env, github, Number(assignMatch[1]));
  }

  const statusMatch = path.match(/^\/v1\/issues\/(\d+)\/status$/);
  if (method === 'GET' && statusMatch) {
    const num = Number(statusMatch[1]);
    const res = await github.getIssue(num);
    if (!res.ok) {
      const mapped = mapGithubError(res.status, res.data);
      return json(mapped.status, mapped);
    }
    return json(200, {
      number: res.data.number,
      state: res.data.state,
      title: res.data.title,
      assignees: (res.data.assignees || []).map((a) => a.login),
      html_url: res.data.html_url,
    });
  }

  const prMatch = path.match(/^\/v1\/pulls\/(\d+)$/);
  if (method === 'GET' && prMatch) {
    const num = Number(prMatch[1]);
    const res = await github.getPull(num);
    if (!res.ok) {
      const mapped = mapGithubError(res.status, res.data);
      return json(mapped.status, mapped);
    }
    let ci = 'CI_NOT_CONFIGURED';
    try {
      const st = await github.getCombinedStatus(res.data.head?.sha);
      if (st.ok && st.data?.state) ci = st.data.state;
    } catch {
      ci = 'CI_NOT_CONFIGURED';
    }
    return json(200, {
      number: res.data.number,
      title: res.data.title,
      state: res.data.state,
      html_url: res.data.html_url,
      head_sha: res.data.head?.sha,
      base: res.data.base?.ref,
      mergeable: res.data.mergeable,
      mergeable_state: res.data.mergeable_state,
      ci,
      repository: FIXED_FULL_NAME,
    });
  }

  const diffMatch = path.match(/^\/v1\/pulls\/(\d+)\/diff$/);
  if (method === 'GET' && diffMatch) {
    const num = Number(diffMatch[1]);
    const files = await github.getPullFiles(num);
    const diff = await github.getPullDiff(num);
    if (!diff.ok) {
      const mapped = mapGithubError(diff.status, { message: 'Failed to fetch diff' });
      return json(mapped.status, mapped);
    }
    return json(200, {
      number: num,
      files: files.ok
        ? (files.data || []).map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          }))
        : [],
      diff: typeof diff.data === 'string' ? diff.data : '',
      repository: FIXED_FULL_NAME,
    });
  }

  return json(404, { error: 'NOT_FOUND', message: 'Unknown endpoint' });
}

async function handleCreateIssue(request, env, github) {
  const idemKey = request.headers.get('idempotency-key');
  if (!idemKey) {
    return json(400, { error: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header required' });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'INVALID_JSON', message: 'Body must be JSON' });
  }
  if (body.repository && body.repository !== FIXED_FULL_NAME) {
    return json(403, { error: 'REPO_NOT_ALLOWED', message: `Only ${FIXED_FULL_NAME}` });
  }
  if (body.base_branch && body.base_branch !== FIXED_BASE_BRANCH) {
    return json(403, { error: 'BASE_BRANCH_NOT_ALLOWED', message: `Only ${FIXED_BASE_BRANCH}` });
  }
  const gateCheck = validateGate({
    gate: body.gate,
    expectedGate: GATES.CREATE_ISSUE,
    confirmed_at: body.confirmed_at,
    run_id: body.run_id,
  });
  if (!gateCheck.ok) {
    return json(gateCheck.status, { error: gateCheck.error, message: gateCheck.message });
  }
  const hash = await requestHash({
    op: 'create_issue',
    title: body.title,
    body: body.body,
    run_id: body.run_id,
    gate: body.gate,
  });

  const store = env.store;
  const result = await store.executeWrite({
    idempotencyKey: idemKey,
    requestHash: hash,
    operation: 'create_issue',
    runId: body.run_id,
    gate: body.gate,
    githubCall: async () => {
      const res = await github.createIssue({ title: body.title, body: body.body, labels: body.labels });
      if (!res.ok) {
        const mapped = mapGithubError(res.status, res.data);
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        safeResult: {
          issue_number: res.data.number,
          number: res.data.number,
          html_url: res.data.html_url,
          title: res.data.title,
          repository: FIXED_FULL_NAME,
        },
      };
    },
  });

  auditEvent({
    endpoint: '/v1/issues',
    run_id: body.run_id,
    gate: body.gate,
    idempotency_key: idemKey,
    outcome: result.replay ? 'replay' : result.unknown ? 'unknown' : result.status,
    github_called: result.githubCalled,
  });
  return json(result.status, result.body);
}

async function handleAssign(request, env, github, issueNumber) {
  const idemKey = request.headers.get('idempotency-key');
  if (!idemKey) {
    return json(400, { error: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header required' });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'INVALID_JSON', message: 'Body must be JSON' });
  }
  const gateCheck = validateGate({
    gate: body.gate,
    expectedGate: GATES.ASSIGN_COPILOT,
    confirmed_at: body.confirmed_at,
    run_id: body.run_id,
  });
  if (!gateCheck.ok) {
    return json(gateCheck.status, { error: gateCheck.error, message: gateCheck.message });
  }

  const runState = env.store.getRun(body.run_id);
  const belong = assertAssignIssueBelongsToRun(runState, issueNumber);
  if (!belong.ok) {
    return json(belong.status, { error: belong.error, message: belong.message });
  }

  const hash = await requestHash({
    op: 'assign_copilot',
    issue_number: issueNumber,
    run_id: body.run_id,
    gate: body.gate,
  });

  const result = await env.store.executeWrite({
    idempotencyKey: idemKey,
    requestHash: hash,
    operation: 'assign_copilot',
    runId: body.run_id,
    gate: body.gate,
    githubCall: async () => {
      const res = await github.assignCopilot(issueNumber);
      const primary = res.assignees;
      if (!primary.ok) {
        const mapped = mapGithubError(primary.status, primary.data);
        return { ok: false, status: mapped.status, safeResult: mapped };
      }
      return {
        ok: true,
        status: 200,
        safeResult: {
          issue_number: issueNumber,
          assigned: (primary.data?.assignees || []).map((a) => a.login),
          repository: FIXED_FULL_NAME,
        },
      };
    },
  });

  auditEvent({
    endpoint: `/v1/issues/${issueNumber}/assign-copilot`,
    run_id: body.run_id,
    gate: body.gate,
    idempotency_key: idemKey,
    issue_number: issueNumber,
    outcome: result.replay ? 'replay' : result.status,
    github_called: result.githubCalled,
  });
  return json(result.status, result.body);
}
