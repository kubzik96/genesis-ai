import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeDurablePersistence,
  GROK_REVIEWER_CAPABILITIES,
  runGrokReview,
  validateReviewOutput,
  validateReviewRequest,
} from '../src/grok-reviewer.js';
import { XAI_REVIEW_CONTEXT_BYTE_LIMIT, XAI_REVIEW_DIFF_BYTE_LIMIT } from '../src/xai-review-contract.js';

const HEAD = 'a'.repeat(40);
const request = (overrides = {}) => ({
  repository: 'kubzik96/genesis-ai', prNumber: 81, expectedHeadSha: HEAD,
  diff: 'diff --git a/a.js b/a.js\n+safe', changedFiles: [{ path: 'a.js', status: 'modified' }],
  context: 'Approved S-0009 acceptance criteria', criteria: ['Apply S-0009'], producer: 'CODEX', ...overrides,
});
const output = (overrides = {}) => ({
  verdict: 'APPROVE', reviewed_head_sha: HEAD, head_confirmed: 'YES', scope: 'CLEAN', findings: [], ready_gate_safe: 'YES', ...overrides,
});
const run = ({ req = request(), response = output(), heads = [HEAD, HEAD], reject = false } = {}) => {
  let headIndex = 0;
  return runGrokReview({
    request: req,
    getCurrentHead: async () => heads[headIndex++],
    reviewClient: { review: async () => { if (reject) throw new Error('provider'); return response; } },
  });
};

describe('Grok reviewer fail-closed orchestration', () => {
  it('accepts a valid exact-HEAD APPROVE but withholds gate evidence until exact persistence acknowledgement', async () => {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.readyGateSafe, 'YES');
    assert.equal(result.consequentialGateEvidenceAvailable, false);
    assert.equal(acknowledgeDurablePersistence(result, { persisted: true, persistedBy: 'TRUSTED_GENESIS', repository: 'kubzik96/genesis-ai', prNumber: 81, reviewedHeadSha: HEAD }).consequentialGateEvidenceAvailable, true);
    assert.equal(acknowledgeDurablePersistence(result, { persisted: true, persistedBy: 'TRUSTED_GENESIS', repository: 'kubzik96/genesis-ai', prNumber: 81, reviewedHeadSha: 'b'.repeat(40) }).verdict, 'BLOCKED');
    assert.equal(acknowledgeDurablePersistence(result, { persisted: true, repository: 'kubzik96/genesis-ai', prNumber: 81, reviewedHeadSha: HEAD }).code, 'PERSISTENCE_NOT_CONFIRMED');
  });

  it('fails request-time and acceptance-time HEAD mismatches closed', async () => {
    assert.equal((await run({ heads: ['b'.repeat(40)] })).code, 'REQUEST_HEAD_MISMATCH');
    const stale = await run({ heads: [HEAD, 'b'.repeat(40)] });
    assert.deepEqual([stale.verdict, stale.readyGateSafe], ['BLOCKED', 'NO']);
    assert.equal(stale.code, 'ACCEPTANCE_HEAD_MISMATCH');
  });

  it('rejects missing/malformed/mismatched reviewed SHAs', () => {
    for (const reviewed_head_sha of [undefined, 'short', 'b'.repeat(40)]) {
      const result = validateReviewOutput(output({ reviewed_head_sha }), HEAD);
      assert.equal(result.verdict, 'BLOCKED');
    }
  });

  it('rejects unknown or missing severity/disposition', () => {
    for (const finding of [
      { severity: 'UNKNOWN', disposition: 'NON_BLOCKING', evidence: 'a.js' },
      { severity: 'LOW', evidence: 'a.js' },
      { disposition: 'BLOCKING', evidence: 'a.js' },
    ]) assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [finding] }), HEAD).code, 'MALFORMED_FINDING');
  });

  it('forces HIGH/CRITICAL and all blocking findings to non-gate-safe fail-closed combinations', () => {
    for (const severity of ['HIGH', 'CRITICAL']) {
      const result = validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [{ severity, disposition: 'NON_BLOCKING', evidence: 'a.js' }] }), HEAD);
      assert.deepEqual([result.verdict, result.readyGateSafe], ['BLOCKED', 'NO']);
    }
    const blocking = { severity: 'MEDIUM', disposition: 'BLOCKING', evidence: 'a.js' };
    for (const verdict of ['APPROVE', 'APPROVE_WITH_FINDINGS']) {
      assert.equal(validateReviewOutput(output({ verdict, findings: [blocking] }), HEAD).code, 'CONTRADICTORY_OUTPUT');
    }
    assert.equal(validateReviewOutput(output({ verdict: 'REQUEST_CHANGES', findings: [blocking], ready_gate_safe: 'YES' }), HEAD).code, 'CONTRADICTORY_OUTPUT');
  });

  it('accepts APPROVE_WITH_FINDINGS only with explicit non-blocking findings', () => {
    const finding = { severity: 'MEDIUM', disposition: 'NON_BLOCKING', evidence: 'a.js:10 advisory' };
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [finding] }), HEAD).ok, true);
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [] }), HEAD).verdict, 'BLOCKED');
  });

  it('rejects contradictory head, scope, verdict, findings, and gate-safe combinations', () => {
    const variants = [
      { head_confirmed: 'NO' }, { scope: 'NOT_CLEAN' },
      { verdict: 'REQUEST_CHANGES' }, { verdict: 'BLOCKED', ready_gate_safe: 'YES' },
      { verdict: 'APPROVE', findings: [{ severity: 'LOW', disposition: 'NON_BLOCKING', evidence: 'a' }] },
    ];
    for (const variant of variants) assert.equal(validateReviewOutput(output(variant), HEAD).code, 'CONTRADICTORY_OUTPUT');
  });

  it('rejects missing, truncated, and oversized bounded context', () => {
    for (const req of [request({ diff: '' }), request({ diffTruncated: true }), request({ context: '' }), request({ contextTruncated: true }),
      request({ diff: 'x'.repeat(XAI_REVIEW_DIFF_BYTE_LIMIT + 1) }), request({ context: 'x'.repeat(XAI_REVIEW_CONTEXT_BYTE_LIMIT + 1) })]) {
      assert.equal(validateReviewRequest(req).verdict, 'BLOCKED');
    }
  });

  it('rejects credential-like input/output and Grok self-review', () => {
    assert.equal(validateReviewRequest(request({ context: `Authorization: Bearer ${'a'.repeat(25)}` })).code, 'SECRET_INPUT_REJECTED');
    assert.equal(validateReviewOutput(output({ findings: [{ severity: 'LOW', disposition: 'NON_BLOCKING', evidence: `github_pat_${'a'.repeat(25)}` }], verdict: 'APPROVE_WITH_FINDINGS' }), HEAD).code, 'SECRET_OUTPUT_REJECTED');
    assert.equal(validateReviewRequest(request({ producer: 'GROK' })).code, 'SELF_REVIEW_REJECTED');
    assert.equal(validateReviewRequest(request({ producer: 'XAI' })).code, 'SELF_REVIEW_REJECTED');
  });

  it('fails API errors closed and exposes zero GitHub write capability', async () => {
    assert.deepEqual([...(GROK_REVIEWER_CAPABILITIES.githubWrite)], []);
    assert.equal('createPullRequest' in GROK_REVIEWER_CAPABILITIES, false);
    const result = await run({ reject: true });
    assert.deepEqual([result.verdict, result.readyGateSafe, result.code], ['BLOCKED', 'NO', 'REVIEW_API_FAILED']);
  });
});
