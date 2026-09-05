import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  orchestrateIndependentReview,
  REVIEWER_ORCHESTRATOR_CAPABILITIES,
  validateReviewerAuthorization,
} from '../src/reviewer-orchestrator.js';

const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);
const CRITERIA = Object.freeze(['Apply S-0010', 'Preserve S-0009 boundaries']);
const FORBIDDEN = Object.freeze([
  'READY', 'MERGE', 'REMEDIATION', 'DEPLOY', 'DIFY', 'BROKER_AUTH_RUNTIME',
  'CLOUDFLARE', 'SECRETS', 'QUARANTINE_REMOVAL', 'REPEAT_MODEL_CALL',
]);

const request = (overrides = {}) => ({
  repository: 'kubzik96/genesis-ai',
  prNumber: 92,
  expectedHeadSha: HEAD,
  diff: 'diff --git a/a.js b/a.js\n+safe',
  diffTruncated: false,
  changedFiles: [{ path: 'a.js', status: 'modified' }],
  context: 'Approved S-0010 implementation context',
  contextTruncated: false,
  criteria: [...CRITERIA],
  producer: 'CODEX',
  ...overrides,
});

const authorization = (overrides = {}) => ({
  repository: 'kubzik96/genesis-ai',
  prNumber: 92,
  expectedHeadSha: HEAD,
  reviewPurpose: 'Independent exact-HEAD implementation review',
  criteria: [...CRITERIA],
  artifactProducer: 'CODEX',
  modelCallAuthorized: true,
  modelRequestLimit: 1,
  durablePersistenceAuthorized: true,
  forbiddenActions: [...FORBIDDEN],
  ...overrides,
});

const output = (overrides = {}) => ({
  verdict: 'APPROVE',
  reviewed_head_sha: HEAD,
  head_confirmed: 'YES',
  scope: 'CLEAN',
  findings: [],
  ready_gate_safe: 'YES',
  ...overrides,
});

function harness({ auth = authorization(), req = request(), heads = [HEAD, HEAD, HEAD], response = output(), apiError = false,
  persistenceResult = true, persistError = false, verifyError = false } = {}) {
  let reviewCalls = 0;
  let persistCalls = 0;
  let verifyCalls = 0;
  let headIndex = 0;
  const boundaries = {
    getCurrentHead: async () => heads[Math.min(headIndex++, heads.length - 1)],
    reviewClient: {
      review: async () => {
        reviewCalls += 1;
        if (apiError) throw new Error('provider');
        return response;
      },
    },
    persistEvidence: async (record) => {
      persistCalls += 1;
      assert.equal(record.reviewer, 'Genesis Independent Grok Reviewer / Grok-xAI');
      assert.equal(record.reviewedHeadSha, HEAD);
      assert.equal(record.evidenceOnly, true);
      assert.equal(record.grantsAuthority, false);
      if (persistError) throw new Error('persist');
      return Object.freeze({ id: 123, reviewedHeadSha: record.reviewedHeadSha });
    },
    verifyPersistence: async (record, receipt) => {
      verifyCalls += 1;
      if (verifyError) throw new Error('verify');
      assert.equal(record.reviewedHeadSha, HEAD);
      assert.equal(receipt.reviewedHeadSha, HEAD);
      return persistenceResult;
    },
  };
  return {
    run: () => orchestrateIndependentReview({ authorization: auth, request: req, ...boundaries }),
    counts: () => ({ reviewCalls, persistCalls, verifyCalls }),
  };
}

describe('S-0010 reviewer orchestration', () => {
  it('blocks missing or malformed authorization before any model call', async () => {
    for (const auth of [undefined, {}, authorization({ modelCallAuthorized: false }), authorization({ modelRequestLimit: 2 }), authorization({ durablePersistenceAuthorized: false })]) {
      const h = harness({ auth });
      const result = await h.run();
      assert.equal(result.nextAction, 'STOP_BLOCKED');
      assert.equal(h.counts().reviewCalls, 0);
    }
  });

  it('blocks repo, PR, HEAD, criteria, and producer mismatches before any model call', async () => {
    const cases = [
      [authorization({ repository: 'other/repo' }), request()],
      [authorization({ prNumber: 93 }), request()],
      [authorization({ expectedHeadSha: OTHER_HEAD }), request()],
      [authorization({ criteria: ['different'] }), request()],
      [authorization({ artifactProducer: 'HUMAN' }), request()],
    ];
    for (const [auth, req] of cases) {
      const h = harness({ auth, req });
      assert.equal((await h.run()).nextAction, 'STOP_BLOCKED');
      assert.equal(h.counts().reviewCalls, 0);
    }
  });

  it('rejects secret-like and incomplete authority envelopes before the reviewer boundary', async () => {
    const secret = authorization({ reviewPurpose: `Authorization: Bearer ${'x'.repeat(30)}` });
    const missingBoundary = authorization({ forbiddenActions: FORBIDDEN.filter((action) => action !== 'MERGE') });
    for (const auth of [secret, missingBoundary]) {
      const h = harness({ auth });
      assert.equal((await h.run()).nextAction, 'STOP_BLOCKED');
      assert.equal(h.counts().reviewCalls, 0);
    }
  });

  it('rejects Grok/xAI self-review before any model call', async () => {
    const auth = authorization({ artifactProducer: 'GROK_XAI' });
    const req = request({ producer: 'OTHER_AI' });
    const h = harness({ auth, req });
    const result = await h.run();
    assert.equal(result.code, 'REVIEW_SELF_REVIEW_FORBIDDEN');
    assert.equal(h.counts().reviewCalls, 0);
  });

  it('makes exactly one reviewer call for a valid authorization and reaches the next CEO gate only after persistence', async () => {
    const h = harness();
    const result = await h.run();
    assert.equal(result.ok, true);
    assert.equal(result.verdict, 'APPROVE');
    assert.equal(result.consequentialGateEvidenceAvailable, true);
    assert.equal(result.nextAction, 'NEXT_CEO_GATE');
    assert.deepEqual(h.counts(), { reviewCalls: 1, persistCalls: 1, verifyCalls: 1 });
  });

  it('blocks request-time HEAD mismatch before the model call', async () => {
    const h = harness({ heads: [OTHER_HEAD] });
    const result = await h.run();
    assert.equal(result.code, 'REQUEST_HEAD_MISMATCH');
    assert.equal(h.counts().reviewCalls, 0);
    assert.equal(h.counts().persistCalls, 0);
  });

  it('blocks acceptance-time HEAD change after exactly one model call and never persists positive evidence', async () => {
    const h = harness({ heads: [HEAD, OTHER_HEAD] });
    const result = await h.run();
    assert.equal(result.code, 'ACCEPTANCE_HEAD_MISMATCH');
    assert.equal(result.nextAction, 'STOP_BLOCKED');
    assert.deepEqual(h.counts(), { reviewCalls: 1, persistCalls: 0, verifyCalls: 0 });
  });

  it('blocks malformed reviewer output and provider failure without retry or persistence', async () => {
    for (const options of [
      { response: output({ verdict: 'APPROVE', findings: [{ severity: 'LOW', disposition: 'NON_BLOCKING', evidence: 'contradiction' }] }) },
      { apiError: true },
    ]) {
      const h = harness(options);
      const result = await h.run();
      assert.equal(result.nextAction, 'STOP_BLOCKED');
      assert.deepEqual(h.counts(), { reviewCalls: 1, persistCalls: 0, verifyCalls: 0 });
    }
  });

  it('requires both trusted persistence boundaries before invoking the model', async () => {
    let reviewCalls = 0;
    const result = await orchestrateIndependentReview({
      authorization: authorization(),
      request: request(),
      getCurrentHead: async () => HEAD,
      reviewClient: { review: async () => { reviewCalls += 1; return output(); } },
    });
    assert.equal(result.code, 'PERSISTENCE_BOUNDARY_UNAVAILABLE');
    assert.equal(result.nextAction, 'STOP_BLOCKED');
    assert.equal(reviewCalls, 0);
  });

  it('blocks persistence errors or unverified persistence and exposes no consequential evidence', async () => {
    for (const options of [{ persistError: true }, { verifyError: true }, { persistenceResult: false }]) {
      const h = harness(options);
      const result = await h.run();
      assert.equal(result.nextAction, 'STOP_BLOCKED');
      assert.equal(result.consequentialGateEvidenceAvailable, false);
      assert.equal(h.counts().reviewCalls, 1);
    }
  });

  it('blocks a HEAD change immediately before persistence', async () => {
    const h = harness({ heads: [HEAD, HEAD, OTHER_HEAD] });
    const result = await h.run();
    assert.equal(result.code, 'PERSISTENCE_HEAD_MISMATCH');
    assert.equal(result.nextAction, 'STOP_BLOCKED');
    assert.deepEqual(h.counts(), { reviewCalls: 1, persistCalls: 0, verifyCalls: 0 });
  });

  it('persists a valid non-gate-safe reviewer verdict but still stops instead of chaining authority', async () => {
    const finding = { severity: 'MEDIUM', disposition: 'BLOCKING', evidence: 'a.js:1 requirement not met' };
    const h = harness({ response: output({ verdict: 'REQUEST_CHANGES', findings: [finding], ready_gate_safe: 'NO' }) });
    const result = await h.run();
    assert.equal(result.ok, true);
    assert.equal(result.consequentialGateEvidenceAvailable, true);
    assert.equal(result.nextAction, 'STOP_BLOCKED');
    assert.deepEqual(h.counts(), { reviewCalls: 1, persistCalls: 1, verifyCalls: 1 });
  });

  it('has no retry, reviewer GitHub-write, or automatic consequential-action capability surface', () => {
    assert.equal(REVIEWER_ORCHESTRATOR_CAPABILITIES.modelRequestsPerAuthorization, 1);
    assert.equal(REVIEWER_ORCHESTRATOR_CAPABILITIES.automaticRetry, false);
    assert.deepEqual([...REVIEWER_ORCHESTRATOR_CAPABILITIES.githubWriteByReviewer], []);
    assert.deepEqual([...REVIEWER_ORCHESTRATOR_CAPABILITIES.automaticConsequentialActions], []);
    assert.equal('apiKey' in REVIEWER_ORCHESTRATOR_CAPABILITIES, false);
    assert.equal('merge' in REVIEWER_ORCHESTRATOR_CAPABILITIES, false);
    assert.equal('ready' in REVIEWER_ORCHESTRATOR_CAPABILITIES, false);
  });

  it('validates the exact closed authorization shape directly', () => {
    assert.equal(validateReviewerAuthorization(authorization(), request()).ok, true);
    assert.equal(validateReviewerAuthorization({ ...authorization(), extraAuthority: true }, request()).ok, false);
  });
});
