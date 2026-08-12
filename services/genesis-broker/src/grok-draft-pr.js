/**
 * Limited Grok draft-PR executor (T-011 Stage 1).
 * Fail-closed composite: validate → xAI → hard limits → dual SHA → writes → draft PR.
 */

import {
  OP_GROK_DRAFT_PR,
  GROK_ALLOWED_FILE,
  REPO_OWNER,
  REPO_NAME,
  DEFAULT_BASE_BRANCH,
} from './constants.js';
import { validateGrokDraftPrRequest, validateGrokResponse, enforceHardLimits } from './grok-validate.js';
import { isAllowedGrokFile } from './allowlist.js';

/**
 * @param {object} ctx
 * @param {object} body - validated request body
 * @param {object} clients - { github, xai, store }
 */
export async function executeGrokDraftPr(ctx, body, clients) {
  const { github, xai, store } = clients;
  const runId = body.run_id;
  const baseBranch = body.base_branch || DEFAULT_BASE_BRANCH;
  const requestHash = body.request_hash || ctx.requestHash;

  // 1. Idempotency check
  const existing = await store.getIdempotency(requestHash);
  if (existing?.hit) {
    return { ...existing.response, replayed: true };
  }

  // 2. Run bounds
  const bounds = await store.checkRunBounds(runId, OP_GROK_DRAFT_PR);
  if (!bounds.allowed) {
    return fail(429, 'run_bound_exceeded', { count: bounds.count, max: bounds.max });
  }

  // 3. Base SHA (first check)
  let baseSha;
  try {
    baseSha = await github.getRefSha(baseBranch);
  } catch (e) {
    return fail(502, 'github_ref_error', { message: String(e.message) });
  }

  if (body.expected_base_sha && body.expected_base_sha !== baseSha) {
    return fail(409, 'base_sha_mismatch', {
      expected: body.expected_base_sha,
      actual: baseSha,
    });
  }

  // 4. Call xAI (closed contract)
  let modelOut;
  try {
    modelOut = await xai.generateDraftEdit({
      file: GROK_ALLOWED_FILE,
      instruction: body.instruction,
      context: body.context || null,
    });
  } catch (e) {
    return fail(502, 'xai_error', { message: String(e.message) });
  }

  // 5. Validate model response + hard limits
  const v = validateGrokResponse(modelOut);
  if (!v.ok) {
    return fail(422, 'model_validation_failed', { errors: v.errors });
  }

  const limits = enforceHardLimits(v.normalized);
  if (!limits.ok) {
    return fail(422, 'hard_limits_exceeded', { reasons: limits.reasons });
  }

  if (!isAllowedGrokFile(v.normalized.path)) {
    return fail(422, 'file_not_allowed', { path: v.normalized.path });
  }

  // 6. Dual base-SHA check (second)
  let baseSha2;
  try {
    baseSha2 = await github.getRefSha(baseBranch);
  } catch (e) {
    return fail(502, 'github_ref_error', { message: String(e.message) });
  }
  if (baseSha2 !== baseSha) {
    return fail(409, 'base_sha_race', { first: baseSha, second: baseSha2 });
  }

  // 7. Execute writes (clean sequence)
  let result;
  try {
    result = await executeWritesClean(github, {
      baseSha,
      baseBranch,
      branchName: body.branch_name,
      path: v.normalized.path,
      content: v.normalized.content,
      commitMessage: body.commit_message || `chore: limited grok edit of ${v.normalized.path}`,
      prTitle: body.pr_title || `Draft: limited Grok edit of ${v.normalized.path}`,
      prBody: body.pr_body || 'Auto-generated draft PR (T-011 Stage 1). Do not merge without review.',
    });
  } catch (e) {
    // Partial failure → UNKNOWN (fail-closed)
    await store.audit('grok_draft_pr_partial_failure', runId, {
      error: String(e.message),
      phase: e.phase || 'unknown',
    });
    return fail(500, 'partial_failure_unknown', {
      message: 'Writes may be incomplete; manual inspection required',
      phase: e.phase || 'unknown',
    });
  }

  await store.incrementRunBounds(runId, OP_GROK_DRAFT_PR);
  await store.audit('grok_draft_pr_success', runId, {
    branch: result.branch,
    commitSha: result.commitSha,
    prNumber: result.prNumber,
    prUrl: result.prUrl,
    path: v.normalized.path,
  });

  const response = {
    ok: true,
    operation: OP_GROK_DRAFT_PR,
    branch: result.branch,
    commit_sha: result.commitSha,
    pr_number: result.prNumber,
    pr_url: result.prUrl,
    draft: true,
    path: v.normalized.path,
  };

  await store.putIdempotency(requestHash, response);
  return response;
}

/**
 * Clean write sequence: blob → tree → commit → ref → draft PR.
 * Throws with .phase on any step failure.
 */
async function executeWritesClean(github, opts) {
  const {
    baseSha,
    baseBranch,
    branchName,
    path,
    content,
    commitMessage,
    prTitle,
    prBody,
  } = opts;

  let phase = 'get_commit';
  const parentCommit = await github.getCommit(baseSha);
  const baseTreeSha = parentCommit.tree.sha;

  phase = 'create_blob';
  const blob = await github.createBlob(content, 'utf-8');

  phase = 'create_tree';
  const tree = await github.createTree(baseTreeSha, [
    {
      path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    },
  ]);

  phase = 'create_commit';
  const commit = await github.createCommit(commitMessage, tree.sha, baseSha);

  phase = 'create_ref';
  await github.createRef(branchName, commit.sha);

  phase = 'create_pull';
  const pr = await github.createPull({
    title: prTitle,
    head: branchName,
    base: baseBranch,
    body: prBody,
    draft: true,
  });

  return {
    branch: branchName,
    commitSha: commit.sha,
    prNumber: pr.number,
    prUrl: pr.html_url,
  };
}

function fail(status, code, details = {}) {
  return {
    ok: false,
    status,
    error: code,
    ...details,
  };
}
