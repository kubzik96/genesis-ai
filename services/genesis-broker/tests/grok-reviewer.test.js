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
const persist = (result, { head = HEAD, verified = true, headError = false, persistenceError = false } = {}) => acknowledgeDurablePersistence(result, {
  getCurrentHead: async () => { if (headError) throw new Error('head'); return head; },
  verifyPersistence: async (record) => { if (persistenceError) throw new Error('persist'); assert.equal(record.reviewedHeadSha, HEAD); return verified; },
});

describe('Grok reviewer fail-closed orchestration', () => {
  it('accepts exact-HEAD APPROVE but requires fresh HEAD plus trusted persistence verification for gate evidence', async () => {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.readyGateSafe, 'YES');
    assert.equal(result.consequentialGateEvidenceAvailable, false);
    assert.equal((await persist(result)).consequentialGateEvidenceAvailable, true);
    assert.equal((await persist(result, { verified: false })).code, 'PERSISTENCE_NOT_CONFIRMED');
    assert.equal((await acknowledgeDurablePersistence(result)).code, 'PERSISTENCE_BOUNDARY_UNAVAILABLE');
  });

  it('fails request-time, acceptance-time, and pre-persistence HEAD changes closed', async () => {
    assert.equal((await run({ heads: ['b'.repeat(40)] })).code, 'REQUEST_HEAD_MISMATCH');
    const stale = await run({ heads: [HEAD, 'b'.repeat(40)] });
    assert.deepEqual([stale.verdict, stale.readyGateSafe], ['BLOCKED', 'NO']);
    assert.equal(stale.code, 'ACCEPTANCE_HEAD_MISMATCH');
    const valid = await run();
    assert.equal((await persist(valid, { head: 'b'.repeat(40) })).code, 'PERSISTENCE_HEAD_MISMATCH');
    assert.equal((await persist(valid, { headError: true })).code, 'HEAD_READ_FAILED');
  });

  it('rejects forged, failed, and malformed persistence evidence without throwing', async () => {
    const result = await run();
    assert.equal((await acknowledgeDurablePersistence(result, { persisted: true, persistedBy: 'TRUSTED_GENESIS', reviewedHeadSha: HEAD })).verdict, 'BLOCKED');
    assert.equal((await persist(result, { persistenceError: true })).code, 'PERSISTENCE_NOT_CONFIRMED');
    assert.equal((await acknowledgeDurablePersistence({ ...result, reviewedHeadSha: 42 }, { getCurrentHead: async () => HEAD, verifyPersistence: async () => true })).code, 'PERSISTENCE_NOT_CONFIRMED');
  });

  it('rejects missing/malformed/mismatched reviewed SHAs', () => {
    for (const reviewed_head_sha of [undefined, 'short', 'b'.repeat(40)]) {
      const result = validateReviewOutput(output({ reviewed_head_sha }), HEAD);
      assert.equal(result.verdict, 'BLOCKED');
    }
  });

  it('requires canonical closed producer provenance and rejects self-review aliases', () => {
    assert.equal(validateReviewRequest(request()).ok, true);
    for (const producer of [undefined, null, '', 'grok', 'GROK', 'XAI', 'xai', 'UNKNOWN', 42]) {
      assert.equal(validateReviewRequest(request({ producer })).verdict, 'BLOCKED');
    }
    assert.equal(validateReviewRequest(request({ producer: 'HUMAN' })).ok, true);
    assert.equal(validateReviewRequest(request({ producer: 'OTHER_AI' })).ok, true);
  });

  it('rejects unknown or missing severity/disposition', () => {
    for (const finding of [
      { severity: 'UNKNOWN', disposition: 'NON_BLOCKING', evidence: 'a.js' },
      { severity: 'LOW', evidence: 'a.js' },
      { disposition: 'BLOCKING', evidence: 'a.js' },
    ]) assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [finding] }), HEAD).code, 'MALFORMED_FINDING');
  });

  it('enforces runtime finding-count and Unicode code-point evidence-length bounds', () => {
    const finding = { severity: 'LOW', disposition: 'NON_BLOCKING', evidence: 'ok' };
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: Array.from({ length: 101 }, () => finding) }), HEAD).code, 'MALFORMED_OUTPUT');
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [{ ...finding, evidence: 'x'.repeat(2001) }] }), HEAD).code, 'MALFORMED_FINDING');
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [{ ...finding, evidence: '😀'.repeat(2000) }] }), HEAD).ok, true);
    assert.equal(validateReviewOutput(output({ verdict: 'APPROVE_WITH_FINDINGS', findings: [{ ...finding, evidence: '😀'.repeat(2001) }] }), HEAD).code, 'MALFORMED_FINDING');
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

  it('rejects credential-like input/output', () => {
    assert.equal(validateReviewRequest(request({ context: `Authorization: Bearer ${'a'.repeat(25)}` })).code, 'SECRET_INPUT_REJECTED');
    assert.equal(validateReviewOutput(output({ findings: [{ severity: 'LOW', disposition: 'NON_BLOCKING', evidence: `github_pat_${'a'.repeat(25)}` }], verdict: 'APPROVE_WITH_FINDINGS' }), HEAD).code, 'SECRET_OUTPUT_REJECTED');
  });

  it('fails API errors closed and exposes zero GitHub write capability', async () => {
    assert.deepEqual([...(GROK_REVIEWER_CAPABILITIES.githubWrite)], []);
    assert.equal('createPullRequest' in GROK_REVIEWER_CAPABILITIES, false);
    const result = await run({ reject: true });
    assert.deepEqual([result.verdict, result.readyGateSafe, result.code], ['BLOCKED', 'NO', 'REVIEW_API_FAILED']);
  });
});
