import {
  FIXED_BASE_BRANCH,
  FIXED_FULL_NAME,
  GROK_DRAFT_PR_LIMITS,
  GROK_DRAFT_PR_OPERATION,
} from './constants.js';
import { mapGithubError } from './github-client.js';

const HEX_40 = /^[a-f0-9]{40}$/i;
const RUN_ID_BRANCH = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_TASK_TITLE_LENGTH = 120;
const MAX_TASK_INSTRUCTION_LENGTH = 2000;
const MAX_SUMMARY_LENGTH = 500;
const REQUEST_TOP_LEVEL_KEYS = new Set([
  'operation',
  'run_id',
  'gate',
  'confirmed_at',
  'base_sha',
  'task',
]);
const TASK_KEYS = new Set(['title', 'instruction', 'allowed_files']);
const RESPONSE_KEYS = new Set(['summary', 'changes', 'self_check']);
const CHANGE_KEYS = new Set(['path', 'expected_blob_sha', 'new_content']);
const SELF_CHECK_KEYS = new Set(['scope_ok']);
const MAX_DIFF_INPUT_BYTES = 64 * 1024;
const MAX_DIFF_INPUT_LINES = 4096;

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
  if (body.task.title.trim().length > MAX_TASK_TITLE_LENGTH) {
    return fail(422, 'INVALID_TASK', `task.title too long (max ${MAX_TASK_TITLE_LENGTH})`);
  }
  if (!body.task.instruction || typeof body.task.instruction !== 'string' || !body.task.instruction.trim()) {
    return fail(400, 'INVALID_TASK', 'task.instruction is required');
  }
  if (body.task.instruction.trim().length > MAX_TASK_INSTRUCTION_LENGTH) {
    return fail(422, 'INVALID_TASK', `task.instruction too long (max ${MAX_TASK_INSTRUCTION_LENGTH})`);
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

function hasUnpairedSurrogates(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function hasDisallowedControlChars(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
  }
  return false;
}

function decodeBase64ToBytes(raw) {
  if (typeof raw !== 'string') {
    return fail(422, 'INVALID_BASE64', 'Base64 payload must be string');
  }
  const normalized = raw.replace(/\s+/g, '');
  if (!normalized || normalized.length % 4 !== 0 || !BASE64_RE.test(normalized)) {
    return fail(422, 'INVALID_BASE64', 'Malformed base64 payload');
  }
  try {
    const bin = atob(normalized);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return { ok: true, value: out };
  } catch {
    return fail(422, 'INVALID_BASE64', 'Malformed base64 payload');
  }
}

function decodeUtf8Bytes(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\u0000') || hasUnpairedSurrogates(text) || hasDisallowedControlChars(text)) {
      return fail(422, 'BINARY_CONTENT_REJECTED', 'Only UTF-8 text payload is allowed');
    }
    return { ok: true, value: text };
  } catch {
    return fail(422, 'INVALID_UTF8', 'Invalid UTF-8 payload');
  }
}

function encodeUtf8ToBytes(text) {
  if (typeof text !== 'string' || hasUnpairedSurrogates(text) || text.includes('\u0000') || hasDisallowedControlChars(text)) {
    return fail(422, 'BINARY_CONTENT_REJECTED', 'Only UTF-8 text payload is allowed');
  }
  return { ok: true, value: new TextEncoder().encode(text) };
}

function encodeUtf8ToBase64(text) {
  const encoded = encodeUtf8ToBytes(text);
  if (!encoded.ok) return encoded;
  const bytes = encoded.value;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { ok: true, value: btoa(bin) };
}

function validateTextPayload(value) {
  if (typeof value !== 'string' || hasUnpairedSurrogates(value) || value.includes('\u0000') || hasDisallowedControlChars(value)) {
    return fail(422, 'BINARY_CONTENT_REJECTED', 'Only UTF-8 text payload is allowed');
  }
  return { ok: true, value };
}

function validateSelfCheck(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !hasOnlyKnownKeys(value, SELF_CHECK_KEYS)) {
    return fail(422, 'INVALID_XAI_RESPONSE', 'self_check schema invalid');
  }
  if (value.scope_ok !== true) {
    return fail(422, 'SCOPE_NOT_AFFIRMED', 'self_check.scope_ok must be true');
  }
  return { ok: true, value: { scope_ok: true } };
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
  if (typeof payload.summary !== 'string' || !payload.summary.trim() || payload.summary.length > MAX_SUMMARY_LENGTH) {
    return fail(422, 'INVALID_XAI_RESPONSE', `summary must be non-empty string up to ${MAX_SUMMARY_LENGTH} chars`);
  }
  const selfCheck = validateSelfCheck(payload.self_check);
  if (!selfCheck.ok) return selfCheck;
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
  const validatedText = validateTextPayload(change.new_content);
  if (!validatedText.ok) return validatedText;
  return {
    ok: true,
    value: {
      summary: payload.summary.trim(),
      selfCheck: selfCheck.value,
      change: {
        path,
        expectedBlobSha: change.expected_blob_sha.toLowerCase(),
        newContent: validatedText.value,
      },
    },
  };
}

const UNIFIED_CONTEXT_LINES = 3;

function splitLines(text) {
  if (text === '') return { lines: [], hasFinalNewline: false };
  const hasFinalNewline = text.endsWith('\n');
  const lines = text.split('\n');
  if (hasFinalNewline) lines.pop();
  return { lines, hasFinalNewline };
}

function countLinesBounded(text, maxLines) {
  let lines = 1;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 0x0a) {
      lines += 1;
      if (lines > maxLines) return null;
    }
  }
  return lines;
}

function annotateIndices(ops) {
  let oldPos = 1;
  let newPos = 1;
  return ops.map((op) => {
    const withIndices = { ...op, oldIndex: oldPos, newIndex: newPos };
    if (op.type === 'equal') {
      oldPos += 1;
      newPos += 1;
    } else if (op.type === 'delete') {
      oldPos += 1;
    } else {
      newPos += 1;
    }
    return withIndices;
  });
}

function buildEditScriptBounded(oldLines, newLines, maxEdits) {
  const n = oldLines.length;
  const m = newLines.length;
  if (Math.abs(n - m) > maxEdits) return null;
  const dp = Array.from({ length: n + 1 }, () => new Map());
  const parent = Array.from({ length: n + 1 }, () => new Map());
  dp[0].set(0, 0);
  for (let i = 0; i <= n; i += 1) {
    const jMin = Math.max(0, i - maxEdits);
    const jMax = Math.min(m, i + maxEdits);
    for (let j = jMin; j <= jMax; j += 1) {
      if (i === 0 && j === 0) continue;
      let best = Number.POSITIVE_INFINITY;
      let bestMove = null;
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        const v = dp[i - 1].get(j - 1);
        if (v !== undefined && v < best) {
          best = v;
          bestMove = 'equal';
        }
      }
      if (i > 0) {
        const v = dp[i - 1].get(j);
        if (v !== undefined && v + 1 < best) {
          best = v + 1;
          bestMove = 'delete';
        }
      }
      if (j > 0) {
        const v = dp[i].get(j - 1);
        if (v !== undefined && v + 1 < best) {
          best = v + 1;
          bestMove = 'add';
        }
      }
      if (best <= maxEdits) {
        dp[i].set(j, best);
        parent[i].set(j, bestMove);
      }
    }
  }
  const editDistance = dp[n].get(m);
  if (editDistance === undefined || editDistance > maxEdits) return null;
  let i = n;
  let j = m;
  const edits = [];
  while (i > 0 || j > 0) {
    const move = parent[i].get(j);
    if (move === 'equal') {
      edits.push({ type: 'equal', line: oldLines[i - 1] });
      i -= 1;
      j -= 1;
    } else if (move === 'delete') {
      edits.push({ type: 'delete', line: oldLines[i - 1] });
      i -= 1;
    } else if (move === 'add') {
      edits.push({ type: 'add', line: newLines[j - 1] });
      j -= 1;
    } else {
      return null;
    }
  }
  edits.reverse();
  return annotateIndices(edits);
}

function applyFinalNewlineSemantics(ops, { oldLineCount, newLineCount, oldHasFinalNewline, newHasFinalNewline }) {
  if (oldHasFinalNewline === newHasFinalNewline || oldLineCount === 0 || newLineCount === 0) return ops;
  let finalEqualIndex = -1;
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (op.type === 'equal' && op.oldIndex === oldLineCount && op.newIndex === newLineCount) {
      finalEqualIndex = i;
      break;
    }
  }
  if (finalEqualIndex < 0) return ops;
  const bareOps = ops.map((op) => ({ type: op.type, line: op.line }));
  const [finalEqual] = bareOps.splice(finalEqualIndex, 1);
  bareOps.splice(finalEqualIndex, 0, { type: 'delete', line: finalEqual.line }, { type: 'add', line: finalEqual.line });
  return annotateIndices(bareOps);
}

function buildUnifiedHunkRanges(ops, contextLines) {
  const changeIndices = [];
  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i].type !== 'equal') changeIndices.push(i);
  }
  if (changeIndices.length === 0) return [];
  const ranges = [];
  let start = Math.max(0, changeIndices[0] - contextLines);
  let end = Math.min(ops.length - 1, changeIndices[0] + contextLines);
  for (let i = 1; i < changeIndices.length; i += 1) {
    const idx = changeIndices[i];
    const nextStart = Math.max(0, idx - contextLines);
    const nextEnd = Math.min(ops.length - 1, idx + contextLines);
    if (nextStart <= end + 1) {
      end = Math.max(end, nextEnd);
      continue;
    }
    ranges.push([start, end]);
    start = nextStart;
    end = nextEnd;
  }
  ranges.push([start, end]);
  return ranges;
}

function formatUnifiedRange(start, count) {
  if (count === 0) return '0,0';
  if (count === 1) return String(start);
  return `${start},${count}`;
}

function countUnifiedDiffBytesBounded({
  path,
  ops,
  oldLineCount,
  newLineCount,
  oldHasFinalNewline,
  newHasFinalNewline,
  maxBytes,
}) {
  const encoder = new TextEncoder();
  let total = 0;
  const add = (line) => {
    total += encoder.encode(line).length;
    if (total > maxBytes) return false;
    return true;
  };
  if (!add(`--- a/${path}\n`)) return { ok: false, exceeded: true, bytes: total };
  if (!add(`+++ b/${path}\n`)) return { ok: false, exceeded: true, bytes: total };
  const ranges = buildUnifiedHunkRanges(ops, UNIFIED_CONTEXT_LINES);
  for (const [start, end] of ranges) {
    const hunkOps = ops.slice(start, end + 1);
    const first = hunkOps[0];
    let oldCount = 0;
    let newCount = 0;
    for (const op of hunkOps) {
      if (op.type !== 'add') oldCount += 1;
      if (op.type !== 'delete') newCount += 1;
    }
    const oldStart = oldCount === 0 ? (oldLineCount === 0 ? 0 : first.oldIndex) : first.oldIndex;
    const newStart = newCount === 0 ? (newLineCount === 0 ? 0 : first.newIndex) : first.newIndex;
    if (!add(`@@ -${formatUnifiedRange(oldStart, oldCount)} +${formatUnifiedRange(newStart, newCount)} @@\n`)) {
      return { ok: false, exceeded: true, bytes: total };
    }
    for (const op of hunkOps) {
      if (op.type === 'equal') {
        if (!add(` ${op.line}\n`)) return { ok: false, exceeded: true, bytes: total };
        if (
          (!oldHasFinalNewline || !newHasFinalNewline) &&
          oldLineCount > 0 &&
          newLineCount > 0 &&
          op.oldIndex === oldLineCount &&
          op.newIndex === newLineCount &&
          !add('\\ No newline at end of file\n')
        ) {
          return { ok: false, exceeded: true, bytes: total };
        }
      }
      if (op.type === 'delete') {
        if (!add(`-${op.line}\n`)) return { ok: false, exceeded: true, bytes: total };
        if (!oldHasFinalNewline && oldLineCount > 0 && op.oldIndex === oldLineCount && !add('\\ No newline at end of file\n')) {
          return { ok: false, exceeded: true, bytes: total };
        }
      }
      if (op.type === 'add') {
        if (!add(`+${op.line}\n`)) return { ok: false, exceeded: true, bytes: total };
        if (!newHasFinalNewline && newLineCount > 0 && op.newIndex === newLineCount && !add('\\ No newline at end of file\n')) {
          return { ok: false, exceeded: true, bytes: total };
        }
      }
    }
  }
  return { ok: true, bytes: total };
}

function diffStats(oldContent, newContent, path) {
  const encoder = new TextEncoder();
  const oldBytes = encoder.encode(oldContent).length;
  const newBytes = encoder.encode(newContent).length;
  if (oldBytes > MAX_DIFF_INPUT_BYTES || newBytes > MAX_DIFF_INPUT_BYTES) {
    return fail(422, 'CONTENT_TOO_LARGE', `Content exceeds ${MAX_DIFF_INPUT_BYTES} UTF-8 bytes`);
  }
  if (
    countLinesBounded(oldContent, MAX_DIFF_INPUT_LINES) === null ||
    countLinesBounded(newContent, MAX_DIFF_INPUT_LINES) === null
  ) {
    return fail(422, 'CONTENT_TOO_LARGE', `Content exceeds ${MAX_DIFF_INPUT_LINES} lines`);
  }
  const oldSplit = splitLines(oldContent);
  const newSplit = splitLines(newContent);
  const baseOps = buildEditScriptBounded(oldSplit.lines, newSplit.lines, GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES);
  if (!baseOps) {
    return fail(422, 'CHANGED_LINES_EXCEEDED', `Changed lines must be <= ${GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES}`);
  }
  const ops = applyFinalNewlineSemantics(baseOps, {
    oldLineCount: oldSplit.lines.length,
    newLineCount: newSplit.lines.length,
    oldHasFinalNewline: oldSplit.hasFinalNewline,
    newHasFinalNewline: newSplit.hasFinalNewline,
  });
  let additions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.type === 'add') additions += 1;
    if (op.type === 'delete') deletions += 1;
  }
  const changedLines = additions + deletions;
  const diffCount = countUnifiedDiffBytesBounded({
    path,
    ops,
    oldLineCount: oldSplit.lines.length,
    newLineCount: newSplit.lines.length,
    oldHasFinalNewline: oldSplit.hasFinalNewline,
    newHasFinalNewline: newSplit.hasFinalNewline,
    maxBytes: GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES,
  });
  if (!diffCount.ok) {
    if (diffCount.exceeded) {
      return {
        ok: true,
        additions,
        deletions,
        changedLines,
        diffBytes: diffCount.bytes,
        diffExceeded: true,
      };
    }
    return fail(422, 'INVALID_DIFF', 'Failed to compute unified diff');
  }
  return { ok: true, additions, deletions, changedLines, diffBytes: diffCount.bytes, diffExceeded: false };
}

function safeResult(status, message) {
  return { error: status, message };
}

function makePostBranchFailure(status, githubStatus, error, message) {
  return {
    ok: false,
    status,
    githubStatus,
    postBranchFailure: true,
    safeResult: safeResult(error, message),
  };
}

function validateCommitSha(commitRes) {
  const sha = String(commitRes?.data?.commit?.sha || '').toLowerCase();
  if (!HEX_40.test(sha)) return null;
  return sha;
}

function validatePullSuccessArtifacts(pullRes, { expectedBranch, expectedHeadSha }) {
  const number = pullRes?.data?.number;
  if (!Number.isInteger(number) || number <= 0) {
    return fail(422, 'INVALID_PR_ARTIFACT', 'PR number must be a positive integer');
  }
  const expectedUrl = `https://github.com/${FIXED_FULL_NAME}/pull/${number}`;
  if (pullRes?.data?.html_url !== expectedUrl) {
    return fail(422, 'INVALID_PR_ARTIFACT', 'PR URL must match canonical repository pull URL');
  }
  const headRef = pullRes?.data?.head?.ref;
  if (headRef !== expectedBranch) {
    return fail(422, 'INVALID_PR_ARTIFACT', 'PR head ref mismatch');
  }
  const headSha = String(pullRes?.data?.head?.sha || '').toLowerCase();
  if (!HEX_40.test(headSha) || headSha !== expectedHeadSha) {
    return fail(422, 'INVALID_PR_ARTIFACT', 'PR head SHA mismatch');
  }
  if (pullRes?.data?.base?.ref !== FIXED_BASE_BRANCH) {
    return fail(422, 'INVALID_PR_ARTIFACT', 'PR base ref mismatch');
  }
  if (pullRes?.data?.draft !== true) {
    return fail(422, 'DRAFT_PR_REQUIRED', 'Pull request must be draft');
  }
  return { ok: true, value: { number, url: expectedUrl } };
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
  const sourceBytes = source.data?.encoding === 'base64'
    ? decodeBase64ToBytes(source.data.content || '')
    : encodeUtf8ToBytes(String(source.data?.content || ''));
  if (!sourceBytes.ok) {
    return { ok: false, status: sourceBytes.status, githubStatus: source.status, safeResult: safeResult(sourceBytes.error, sourceBytes.message) };
  }
  const sourceContent = decodeUtf8Bytes(sourceBytes.value);
  if (!sourceContent.ok) {
    return { ok: false, status: sourceContent.status, githubStatus: source.status, safeResult: safeResult(sourceContent.error, sourceContent.message) };
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
        content: sourceContent.value,
      }],
    });
  } catch {
    return { ok: false, status: 422, githubStatus: null, safeResult: safeResult('XAI_CALL_FAILED', 'xAI call failed') };
  }
  const parsed = normalizeXaiResponse(xaiRaw);
  if (!parsed.ok) {
    return { ok: false, status: parsed.status, githubStatus: null, safeResult: safeResult(parsed.error, parsed.message) };
  }
  const { change } = parsed.value;
  if (change.expectedBlobSha !== sourceSha) {
    return { ok: false, status: 422, githubStatus: source.status, safeResult: safeResult('INVALID_BLOB_SHA', 'expected_blob_sha mismatch') };
  }
  const stats = diffStats(sourceContent.value, change.newContent, change.path);
  if (!stats.ok) {
    return { ok: false, status: stats.status, githubStatus: null, safeResult: safeResult(stats.error, stats.message) };
  }
  if (stats.changedLines < 1) {
    return {
      ok: false,
      status: 422,
      githubStatus: null,
      safeResult: safeResult('NO_CHANGES_DETECTED', 'xAI response must produce a non-empty diff'),
    };
  }
  if (stats.changedLines > GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES) {
    return {
      ok: false,
      status: 422,
      githubStatus: null,
      safeResult: safeResult('CHANGED_LINES_EXCEEDED', `Changed lines must be <= ${GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES}`),
    };
  }
  if (stats.diffExceeded) {
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

  const encodedContent = encodeUtf8ToBase64(change.newContent);
  if (!encodedContent.ok) {
    return {
      ok: false,
      status: encodedContent.status,
      githubStatus: null,
      safeResult: safeResult(encodedContent.error, encodedContent.message),
    };
  }
  const commitRes = await github.updateFile({
    path: change.path,
    message: `grok: ${runId}`,
    contentBase64: encodedContent.value,
    branch,
    sha: sourceSha,
  });
  if (!commitRes.ok) {
    return makePostBranchFailure(
      409,
      commitRes.status,
      'BLOCKED_RECONCILIATION_REQUIRED',
      `Post-branch commit failed with status ${commitRes.status}; reconciliation required`,
    );
  }
  const commitSha = validateCommitSha(commitRes);
  if (!commitSha) {
    return makePostBranchFailure(409, commitRes.status, 'BLOCKED_RECONCILIATION_REQUIRED', 'Commit response missing valid SHA; reconciliation required');
  }

  const pullRes = await github.createPullRequest({
    title: `grok: ${runId}`,
    body: [
      `operation: ${GROK_DRAFT_PR_OPERATION}`,
      `run_id: ${runId}`,
      `base_sha: ${baseSha}`,
      `file: ${change.path}`,
    ].join('\n'),
    head: branch,
    base: FIXED_BASE_BRANCH,
    draft: true,
  });
  if (!pullRes.ok) {
    return makePostBranchFailure(
      409,
      pullRes.status,
      'BLOCKED_RECONCILIATION_REQUIRED',
      `Post-branch PR creation failed with status ${pullRes.status}; reconciliation required`,
    );
  }
  const prArtifacts = validatePullSuccessArtifacts(pullRes, { expectedBranch: branch, expectedHeadSha: commitSha });
  if (!prArtifacts.ok) {
    return makePostBranchFailure(409, pullRes.status, 'BLOCKED_RECONCILIATION_REQUIRED', `${prArtifacts.message}; reconciliation required`);
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
      head_sha: commitSha,
      branch,
      pr_number: prArtifacts.value.number,
      pr_url: prArtifacts.value.url,
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
