import {
  FIXED_BASE_BRANCH,
  FIXED_FULL_NAME,
  GROK_DRAFT_PR_LIMITS,
  GROK_DRAFT_PR_OPERATION,
} from './constants.js';
import { mapGithubError } from './github-client.js';

const HEX_40 = /^[a-f0-9]{40}$/i;
const RUN_ID_BRANCH = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const REQUEST_TOP_LEVEL_KEYS = new Set([
  'operation',
  'repository',
  'base_branch',
  'run_id',
  'gate',
  'confirmed_at',
  'base_sha',
  'task',
]);
const TASK_KEYS = new Set(['title', 'instruction', 'allowed_files']);
const RESPONSE_KEYS = new Set(['summary', 'changes', 'self_check']);
const CHANGE_KEYS = new Set(['path', 'expected_blob_sha', 'new_content']);

function hasOnlyKnownKeys(input, known) {
  return Object.keys(input).every((k) => known.has(k));
}

function fail(status, error, message) {
  return { ok: false, status, error, message };
}

export function validateDraftPrRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'INVALID_BODY', 'Body must be JSON object');
  }
  if (!hasOnlyKnownKeys(body, REQUEST_TOP_LEVEL_KEYS)) {
    return fail(400, 'UNKNOWN_FIELD', 'Request contains unknown fields');
  }
  if (body.operation !== GROK_DRAFT_PR_OPERATION) {
    return fail(400, 'INVALID_OPERATION', `operation must be ${GROK_DRAFT_PR_OPERATION}`);
  }
  if (body.repository && body.repository !== FIXED_FULL_NAME) {
    return fail(403, 'REPO_NOT_ALLOWED', `Only ${FIXED_FULL_NAME}`);
  }
  if (body.base_branch && body.base_branch !== FIXED_BASE_BRANCH) {
    return fail(403, 'BASE_BRANCH_NOT_ALLOWED', `Only ${FIXED_BASE_BRANCH}`);
  }
  if (!body.run_id || typeof body.run_id !== 'string' || !body.run_id.trim()) {
    return fail(400, 'INVALID_RUN_ID', 'run_id is required');
  }
  const runId = body.run_id.trim();
  if (!RUN_ID_BRANCH.test(runId)) {
    return fail(400, 'INVALID_RUN_ID', 'run_id must match ^[a-z0-9][a-z0-9._-]{0,80}$');
  }
  if (!body.base_sha || typeof body.base_sha !== 'string' || !HEX_40.test(body.base_sha)) {
    return fail(400, 'INVALID_BASE_SHA', 'base_sha must be 40-char commit SHA');
  }
  if (!body.task || typeof body.task !== 'object' || Array.isArray(body.task)) {
    return fail(400, 'INVALID_TASK', 'task is required');
  }
  if (!hasOnlyKnownKeys(body.task, TASK_KEYS)) {
    return fail(400, 'UNKNOWN_FIELD', 'task contains unknown fields');
  }
  if (!body.task.title || typeof body.task.title !== 'string' || !body.task.title.trim()) {
    return fail(400, 'INVALID_TASK', 'task.title is required');
  }
  if (!body.task.instruction || typeof body.task.instruction !== 'string' || !body.task.instruction.trim()) {
    return fail(400, 'INVALID_TASK', 'task.instruction is required');
  }
  if (!Array.isArray(body.task.allowed_files)) {
    return fail(400, 'INVALID_TASK', 'task.allowed_files must be array');
  }
  if (body.task.allowed_files.length !== GROK_DRAFT_PR_LIMITS.MAX_FILES) {
    return fail(422, 'FILE_COUNT_EXCEEDED', `Exactly ${GROK_DRAFT_PR_LIMITS.MAX_FILES} file allowed`);
  }
  const only = String(body.task.allowed_files[0] || '').replace(/^\/+/, '');
  if (only !== GROK_DRAFT_PR_LIMITS.ALLOWED_FILE) {
    return fail(403, 'PATH_NOT_ALLOWED', `Only ${GROK_DRAFT_PR_LIMITS.ALLOWED_FILE} is allowed`);
  }

  return {
    ok: true,
    value: {
      runId,
      gate: body.gate,
      confirmedAt: body.confirmed_at,
      baseSha: body.base_sha.toLowerCase(),
      task: {
        title: body.task.title.trim(),
        instruction: body.task.instruction.trim(),
        allowedFiles: [only],
      },
    },
  };
}

function safeDecodeBase64(raw) {
  if (typeof raw !== 'string') return '';
  if (typeof atob === 'function') return atob(raw.replace(/\n/g, ''));
  return Buffer.from(raw, 'base64').toString('utf8');
}

function safeEncodeBase64(raw) {
  if (typeof btoa === 'function') return btoa(raw);
  return Buffer.from(raw, 'utf8').toString('base64');
}

function isTextPayload(value) {
  return typeof value === 'string' && !value.includes('\u0000');
}

function extractMainSha(refResponse) {
  const sha = refResponse?.data?.object?.sha;
  if (!sha || typeof sha !== 'string' || !HEX_40.test(sha)) return null;
  return sha.toLowerCase();
}

function normalizeXaiResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail(422, 'INVALID_XAI_RESPONSE', 'xAI response must be object');
  }
  if (!hasOnlyKnownKeys(payload, RESPONSE_KEYS)) {
    return fail(422, 'INVALID_XAI_RESPONSE', 'xAI response contains unknown fields');
  }
  if (!Array.isArray(payload.changes) || payload.changes.length !== 1) {
    return fail(422, 'MULTIPLE_FILES_REJECTED', 'xAI response must contain exactly one change');
  }
  const [change] = payload.changes;
  if (!change || typeof change !== 'object' || Array.isArray(change) || !hasOnlyKnownKeys(change, CHANGE_KEYS)) {
    return fail(422, 'INVALID_XAI_RESPONSE', 'xAI change schema invalid');
  }
  const path = String(change.path || '').replace(/^\/+/, '');
  if (path !== GROK_DRAFT_PR_LIMITS.ALLOWED_FILE) {
    return fail(403, 'PATH_NOT_ALLOWED', `Only ${GROK_DRAFT_PR_LIMITS.ALLOWED_FILE} is allowed`);
  }
  if (typeof change.expected_blob_sha !== 'string' || !HEX_40.test(change.expected_blob_sha)) {
    return fail(422, 'INVALID_BLOB_SHA', 'expected_blob_sha must be 40-char SHA');
  }
  if (!isTextPayload(change.new_content)) {
    return fail(422, 'BINARY_CONTENT_REJECTED', 'Only UTF-8 text payload is allowed');
  }
  return {
    ok: true,
    value: {
      summary: typeof payload.summary === 'string' ? payload.summary : '',
      selfCheck: payload.self_check ?? null,
      change: {
        path,
        expectedBlobSha: change.expected_blob_sha.toLowerCase(),
        newContent: change.new_content,
      },
    },
  };
}

function splitLines(text) {
  return text === '' ? [] : text.split('\n');
}

function buildEditScript(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: 'equal', line: oldLines[i], oldIndex: i + 1, newIndex: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'delete', line: oldLines[i], oldIndex: i + 1, newIndex: j + 1 });
      i += 1;
    } else {
      ops.push({ type: 'add', line: newLines[j], oldIndex: i + 1, newIndex: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: 'delete', line: oldLines[i], oldIndex: i + 1, newIndex: j + 1 });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: 'add', line: newLines[j], oldIndex: i + 1, newIndex: j + 1 });
    j += 1;
  }
  return ops;
}

function diffStats(oldContent, newContent, path) {
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);
  const ops = buildEditScript(oldLines, newLines);
  let additions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.type === 'add') additions += 1;
    if (op.type === 'delete') deletions += 1;
  }
  const changedLines = additions + deletions;
  const hunkOps = ops.filter((op) => op.type !== 'equal');
  let unified = `--- a/${path}\n+++ b/${path}\n`;
  if (hunkOps.length > 0) {
    const first = hunkOps[0];
    const last = hunkOps[hunkOps.length - 1];
    const oldStart = first.oldIndex;
    const newStart = first.newIndex;
    const oldCount = hunkOps.filter((op) => op.type === 'delete').length;
    const newCount = hunkOps.filter((op) => op.type === 'add').length;
    unified += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;
    for (const op of hunkOps) {
      if (op.type === 'delete') unified += `-${op.line}\n`;
      if (op.type === 'add') unified += `+${op.line}\n`;
    }
  }
  const diffBytes = new TextEncoder().encode(unified).length;
  return { additions, deletions, changedLines, diffBytes, unified };
}

function safeResult(status, message) {
  return { error: status, message };
}

export async function executeGrokDraftPrOperation({ github, xai, runId, baseSha, task, gate, confirmedAt }) {
  const mainBefore = await github.getRef(`heads/${FIXED_BASE_BRANCH}`);
  if (!mainBefore.ok) {
    const mapped = mapGithubError(mainBefore.status, mainBefore.data);
    return { ok: false, status: mapped.status, githubStatus: mainBefore.status, safeResult: mapped };
  }
  const mainBeforeSha = extractMainSha(mainBefore);
  if (!mainBeforeSha) {
    return { ok: false, status: 502, githubStatus: mainBefore.status, safeResult: safeResult('INVALID_MAIN_SHA', 'Invalid main SHA from GitHub') };
  }
  if (mainBeforeSha !== baseSha) {
    return {
      ok: false,
      status: 409,
      githubStatus: mainBefore.status,
      safeResult: safeResult('BASE_SHA_MISMATCH', 'base_sha does not match current main'),
    };
  }

  const source = await github.getContentAtRef(GROK_DRAFT_PR_LIMITS.ALLOWED_FILE, baseSha);
  if (!source.ok) {
    const mapped = mapGithubError(source.status, source.data);
    return { ok: false, status: mapped.status, githubStatus: source.status, safeResult: mapped };
  }
  const sourceSha = String(source.data?.sha || '').toLowerCase();
  if (!HEX_40.test(sourceSha)) {
    return { ok: false, status: 422, githubStatus: source.status, safeResult: safeResult('INVALID_BLOB_SHA', 'Failed to resolve source blob SHA') };
  }
  const sourceContent = source.data?.encoding === 'base64'
    ? safeDecodeBase64(source.data.content || '')
    : String(source.data?.content || '');
  if (!isTextPayload(sourceContent)) {
    return { ok: false, status: 422, githubStatus: source.status, safeResult: safeResult('BINARY_CONTENT_REJECTED', 'Source content is not UTF-8 text') };
  }

  if (!xai || typeof xai.generateDraftPrChange !== 'function') {
    return { ok: false, status: 503, githubStatus: null, safeResult: safeResult('XAI_NOT_CONFIGURED', 'xAI mock is not configured') };
  }
  let xaiRaw;
  try {
    xaiRaw = await xai.generateDraftPrChange({
      operation: GROK_DRAFT_PR_OPERATION,
      run_id: runId,
      gate,
      confirmed_at: confirmedAt,
      base_sha: baseSha,
      task: {
        title: task.title,
        instruction: task.instruction,
        allowed_files: task.allowedFiles,
      },
      context: [{
        path: GROK_DRAFT_PR_LIMITS.ALLOWED_FILE,
        sha: sourceSha,
        content: sourceContent,
      }],
    });
  } catch {
    return { ok: false, status: 422, githubStatus: null, safeResult: safeResult('XAI_CALL_FAILED', 'xAI call failed') };
  }
  const parsed = normalizeXaiResponse(xaiRaw);
  if (!parsed.ok) {
    return { ok: false, status: parsed.status, githubStatus: null, safeResult: safeResult(parsed.error, parsed.message) };
  }
  const { change, summary, selfCheck } = parsed.value;
  if (change.expectedBlobSha !== sourceSha) {
    return { ok: false, status: 422, githubStatus: source.status, safeResult: safeResult('INVALID_BLOB_SHA', 'expected_blob_sha mismatch') };
  }
  const stats = diffStats(sourceContent, change.newContent, change.path);
  if (stats.changedLines < 1 || stats.changedLines > GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES) {
    return {
      ok: false,
      status: 422,
      githubStatus: null,
      safeResult: safeResult('CHANGED_LINES_EXCEEDED', `Changed lines must be 1..${GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES}`),
    };
  }
  if (stats.diffBytes > GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES) {
    return {
      ok: false,
      status: 422,
      githubStatus: null,
      safeResult: safeResult('DIFF_SIZE_EXCEEDED', `Unified diff exceeds ${GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES} bytes`),
    };
  }

  const mainAfter = await github.getRef(`heads/${FIXED_BASE_BRANCH}`);
  if (!mainAfter.ok) {
    const mapped = mapGithubError(mainAfter.status, mainAfter.data);
    return { ok: false, status: mapped.status, githubStatus: mainAfter.status, safeResult: mapped };
  }
  const mainAfterSha = extractMainSha(mainAfter);
  if (!mainAfterSha || mainAfterSha !== baseSha) {
    return {
      ok: false,
      status: 409,
      githubStatus: mainAfter.status,
      safeResult: safeResult('BASE_SHA_MISMATCH', 'main changed during xAI call'),
    };
  }

  const branch = `${GROK_DRAFT_PR_LIMITS.BRANCH_PREFIX}${runId}`;
  const branchRes = await github.createRef({ ref: `refs/heads/${branch}`, sha: baseSha });
  if (!branchRes.ok) {
    const mapped = mapGithubError(branchRes.status, branchRes.data);
    return { ok: false, status: mapped.status, githubStatus: branchRes.status, safeResult: mapped };
  }

  const commitRes = await github.updateFile({
    path: change.path,
    message: `grok: ${runId}`,
    contentBase64: safeEncodeBase64(change.newContent),
    branch,
    sha: sourceSha,
  });
  if (!commitRes.ok) {
    const mapped = mapGithubError(commitRes.status, commitRes.data);
    return { ok: false, status: mapped.status, githubStatus: commitRes.status, safeResult: mapped };
  }

  const pullRes = await github.createPullRequest({
    title: task.title,
    body: [
      `operation: ${GROK_DRAFT_PR_OPERATION}`,
      `run_id: ${runId}`,
      `base_sha: ${baseSha}`,
      '',
      summary || '',
      selfCheck ? `self_check: ${JSON.stringify(selfCheck)}` : '',
    ].filter(Boolean).join('\n'),
    head: branch,
    base: FIXED_BASE_BRANCH,
    draft: true,
  });
  if (!pullRes.ok) {
    const mapped = mapGithubError(pullRes.status, pullRes.data);
    return { ok: false, status: mapped.status, githubStatus: pullRes.status, safeResult: mapped };
  }
  if (!pullRes.data?.draft) {
    return {
      ok: false,
      status: 422,
      githubStatus: pullRes.status,
      safeResult: safeResult('DRAFT_PR_REQUIRED', 'Pull request must be draft'),
    };
  }

  return {
    ok: true,
    status: 200,
    githubStatus: pullRes.status,
    safeResult: {
      status: 'DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW',
      operation: GROK_DRAFT_PR_OPERATION,
      run_id: runId,
      repository: FIXED_FULL_NAME,
      base_branch: FIXED_BASE_BRANCH,
      base_sha: baseSha,
      head_sha: commitRes.data?.commit?.sha ?? null,
      branch,
      pr_number: pullRes.data?.number ?? null,
      pr_url: pullRes.data?.html_url ?? null,
      changed_files: [change.path],
      diff_summary: {
        additions: stats.additions,
        deletions: stats.deletions,
        changed_lines: stats.changedLines,
        unified_diff_bytes: stats.diffBytes,
      },
    },
  };
}
