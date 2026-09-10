import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleReviewerRuntimeRequest, isReviewerRuntimeRoute } from '../src/index.js';
import { executeReviewerRuntimeOperation } from '../src/reviewer-runtime.js';
import { createProductionXaiReviewClient } from '../src/xai-review-client.js';
import { createGithubClient } from '../src/github-client.js';

const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);
const PR = 123;
const CRITERIA = Object.freeze(['Preserve S-0010', 'Preserve S-0009/DR-0011']);
const FORBIDDEN = Object.freeze([
  'READY', 'MERGE', 'REMEDIATION', 'DEPLOY', 'DIFY', 'BROKER_AUTH_RUNTIME',
  'CLOUDFLARE', 'SECRETS', 'QUARANTINE_REMOVAL', 'REPEAT_MODEL_CALL',
]);

function authorization(overrides = {}) {
  return {
    grantId: 'github:issue-comment:9001', manifestHash: '1'.repeat(64), issuanceDigest: '2'.repeat(64),
    repository: 'kubzik96/genesis-ai',
    prNumber: PR,
    expectedHeadSha: HEAD,
    reviewPurpose: 'Synthetic runtime integration review fixture',
    criteria: [...CRITERIA],
    artifactProducer: 'CODEX',
    modelCallAuthorized: true,
    modelRequestLimit: 1,
    durablePersistenceAuthorized: true,
    forbiddenActions: [...FORBIDDEN],
    ...overrides,
  };
}

function reviewerOutput(overrides = {}) {
  return {
    verdict: 'APPROVE',
    reviewed_head_sha: HEAD,
    head_confirmed: 'YES',
    scope: 'CLEAN',
    findings: [],
    ready_gate_safe: 'YES',
    ...overrides,
  };
}

function makeRequest(body, { method = 'POST', path = '/v1/reviews/grok', token = 'svc', idempotencyKey = 'review-key' } = {}) {
  return new Request(`https://broker.test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

function makeGithub({
  heads = [HEAD, HEAD, HEAD, HEAD],
  persistOk = true,
  readBackMatches = true,
  files = [{ filename: 'services/genesis-broker/src/index.js', status: 'modified' }],
  diff = 'diff --git a/a.js b/a.js\n+safe runtime integration',
  filesNext = false,
  throwAt = null,
  readBackTransform = null,
} = {}) {
  let headIndex = 0;
  let persistedBody = null;
  let persistCalls = 0;
  let readBackCalls = 0;
  return {
    api: {
      async getPull() {
        if (throwAt === 'getPull') throw new Error('network');
        const sha = heads[Math.min(headIndex++, heads.length - 1)];
        return { ok: true, status: 200, data: { head: { sha } } };
      },
      async getPullFiles() {
        if (throwAt === 'getPullFiles') throw new Error('network');
        return {
          ok: true,
          status: 200,
          data: files,
          headers: new Headers(filesNext ? { link: '<https://api.github.com/next>; rel="next"' } : {}),
        };
      },
      async getPullDiff() {
        if (throwAt === 'getPullDiff') throw new Error('network');
        return { ok: true, status: 200, data: diff, headers: new Headers() };
      },
      async addIssueComment(prNumber, body) {
        persistCalls += 1;
        persistedBody = body;
        if (!persistOk) return { ok: false, status: 500, data: { message: 'fail' } };
        return { ok: true, status: 201, data: { id: 77, issue_url: `https://api.github.com/repos/kubzik96/genesis-ai/issues/${prNumber}` } };
      },
      async getIssueComment() {
        readBackCalls += 1;
        return {
          ok: true,
          status: 200,
          data: {
            id: 77,
            issue_url: `https://api.github.com/repos/kubzik96/genesis-ai/issues/${PR}`,
            body: readBackMatches
              ? (typeof readBackTransform === 'function' ? readBackTransform(persistedBody) : persistedBody)
              : 'GENESIS_REVIEW_EVIDENCE_V2 {"wrong":true}',
          },
        };
      },
    },
    counts: () => ({ persistCalls, readBackCalls, headReads: headIndex }),
  };
}

function env(store, overrides = {}) {
  return {
    BROKER_SERVICE_TOKEN: 'svc',
    GITHUB_PAT: 'pat-for-test-boundary',
    store,
    ...overrides,
  };
}

async function run(body, { githubOptions, reviewImpl, envOverrides } = {}) {
  const gh = makeGithub(githubOptions);
  let reviewCalls = 0;
  const reviewClient = reviewImpl === null ? createProductionXaiReviewClient({
    productionEnabled: envOverrides?.XAI_REVIEWER_LIVE_ENABLED === 'true',
    xaiApiKey: envOverrides?.XAI_API_KEY,
    fetchImpl: envOverrides?.xaiFetch,
  }) : {
    async review(input) {
      reviewCalls += 1;
      if (typeof reviewImpl === 'function') return reviewImpl(input);
      return reviewerOutput();
    },
  };
  const store = {
    async executeReview({ authorization: auth, context }) {
      return executeReviewerRuntimeOperation({ authorization: auth, context, github: gh.api, reviewClient, claimDispatch: async () => true, executionIdentity: { run_id: 'review-run', request_hash: 'offline-request-hash' } });
    },
  };
  const runtimeBody = { ...body, run_id: body?.run_id ?? 'review-run' };
  const response = await handleReviewerRuntimeRequest(
    makeRequest(runtimeBody),
    env(store, envOverrides),
  );
  return { response, body: JSON.parse(response.body), reviewCalls, github: gh };
}

describe('S-0010 reviewer runtime integration', () => {
  it('exposes only the exact POST reviewer route', () => {
    assert.equal(isReviewerRuntimeRoute(makeRequest({})), true);
    assert.equal(isReviewerRuntimeRoute(makeRequest({}, { method: 'GET' })), false);
    assert.equal(isReviewerRuntimeRoute(makeRequest({}, { path: '/v1/reviews/grok/123' })), false);
  });

  it('blocks missing or malformed authorization before reviewer or persistence', async () => {
    for (const auth of [null, {}, authorization({ modelCallAuthorized: false }), authorization({ modelRequestLimit: 2 })]) {
      const r = await run({ authorization: auth, context: 'bounded context' });
      assert.equal(r.response.status, 409);
      assert.equal(r.body.next_action, 'STOP_BLOCKED');
      assert.equal(r.reviewCalls, 0);
      assert.equal(r.github.counts().persistCalls, 0);
    }
  });

  it('requires idempotency and run identifiers before the durable boundary', async () => {
    let storeCalls = 0;
    const store = { async executeReview() { storeCalls += 1; throw new Error('must not run'); } };
    const missingKey = await handleReviewerRuntimeRequest(
      makeRequest({ authorization: authorization(), context: 'bounded', run_id: 'review-run' }, { idempotencyKey: null }),
      env(store),
    );
    assert.equal(missingKey.status, 400);
    const missingRun = await handleReviewerRuntimeRequest(
      makeRequest({ authorization: authorization(), context: 'bounded' }),
      env(store),
    );
    assert.equal(missingRun.status, 400);
    assert.equal(storeCalls, 0);
  });

  it('normalizes a rejected durable-boundary call and preserves same-key retry guidance', async () => {
    const store = { async executeReview() { throw new Error('transport'); } };
    const response = await handleReviewerRuntimeRequest(
      makeRequest({ authorization: authorization(), context: 'bounded', run_id: 'review-run' }),
      env(store),
    );
    const body = JSON.parse(response.body);
    assert.equal(response.status, 503);
    assert.equal(body.error, 'REVIEW_DURABLE_BOUNDARY_UNAVAILABLE');
    assert.match(body.message, /same Idempotency-Key/);
  });

  it('rejects oversized context before the durable or GitHub boundary', async () => {
    let storeCalls = 0;
    const store = { async executeReview() { storeCalls += 1; throw new Error('must not run'); } };
    const response = await handleReviewerRuntimeRequest(
      makeRequest({ authorization: authorization(), context: 'x'.repeat(32 * 1024 + 1), run_id: 'review-run' }),
      env(store),
    );
    assert.equal(response.status, 413);
    assert.equal(storeCalls, 0);
  });

  it('stops streaming a GitHub diff once the byte ceiling is crossed', async () => {
    let fetchCalls = 0;
    const github = createGithubClient({
      pat: 'pat-for-test-boundary',
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('x'.repeat(33), { status: 200 });
      },
    });
    const result = await github.getPullDiff(PR, 32);
    assert.equal(fetchCalls, 1);
    assert.equal(result.ok, false);
    assert.equal(result.status, 413);
    assert.equal(result.tooLarge, true);
    assert.equal(result.data, null);
  });

  it('keeps production transport default-off even when an API-key-shaped value exists', async () => {
    let xaiNetworkCalls = 0;
    const r = await run(
      { authorization: authorization(), context: 'bounded context' },
      {
        reviewImpl: null,
        envOverrides: {
          XAI_API_KEY: `xai-${'k'.repeat(40)}`,
          xaiFetch: async () => {
            xaiNetworkCalls += 1;
            throw new Error('must not be called');
          },
        },
      },
    );
    assert.equal(r.response.status, 409);
    assert.equal(r.body.next_action, 'STOP_BLOCKED');
    assert.equal(xaiNetworkCalls, 0);
    assert.equal(r.github.counts().persistCalls, 0);
  });

  it('blocks stale initial HEAD before any reviewer call', async () => {
    const r = await run(
      { authorization: authorization(), context: 'bounded context' },
      { githubOptions: { heads: [OTHER_HEAD] } },
    );
    assert.equal(r.body.code, 'REQUEST_HEAD_MISMATCH');
    assert.equal(r.reviewCalls, 0);
    assert.equal(r.github.counts().persistCalls, 0);
  });

  it('fails closed when changed-file pagination is incomplete', async () => {
    const r = await run(
      { authorization: authorization(), context: 'bounded context' },
      { githubOptions: { filesNext: true } },
    );
    assert.equal(r.body.code, 'REVIEW_FILES_INCOMPLETE');
    assert.equal(r.reviewCalls, 0);
  });

  it('normalizes rejected GitHub reads without invoking the reviewer', async () => {
    for (const throwAt of ['getPull', 'getPullFiles', 'getPullDiff']) {
      const r = await run(
        { authorization: authorization(), context: 'bounded context' },
        { githubOptions: { throwAt } },
      );
      assert.equal(r.response.status, 409);
      assert.equal(r.body.next_action, 'STOP_BLOCKED');
      assert.equal(r.reviewCalls, 0);
      assert.equal(r.github.counts().persistCalls, 0);
    }
  });

  it('uses trusted GitHub diff/files, calls reviewer once, persists, verifies, then reaches next CEO gate', async () => {
    let seen;
    const r = await run(
      { authorization: authorization(), context: 'canonical bounded context' },
      { reviewImpl: async (input) => { seen = input; return reviewerOutput(); } },
    );
    assert.equal(r.response.status, 200);
    assert.equal(r.reviewCalls, 1);
    assert.equal(seen.prNumber, PR);
    assert.equal(seen.expectedHeadSha, HEAD);
    assert.deepEqual(seen.changedFiles, [{ path: 'services/genesis-broker/src/index.js', status: 'modified' }]);
    assert.match(seen.diff, /safe runtime integration/);
    assert.equal(r.github.counts().persistCalls, 1);
    assert.equal(r.github.counts().readBackCalls, 1);
    assert.equal(r.body.verdict, 'APPROVE');
    assert.equal(r.body.reviewed_head_sha, HEAD);
    assert.equal(r.body.ready_gate_safe, 'YES');
    assert.equal(r.body.consequential_gate_evidence_available, true);
    assert.equal(r.body.next_action, 'NEXT_CEO_GATE');
  });

  it('blocks acceptance-time HEAD change after exactly one reviewer call without persistence', async () => {
    const r = await run(
      { authorization: authorization(), context: 'bounded context' },
      { githubOptions: { heads: [HEAD, HEAD, OTHER_HEAD] } },
    );
    assert.equal(r.reviewCalls, 1);
    assert.equal(r.body.code, 'ACCEPTANCE_HEAD_MISMATCH');
    assert.equal(r.github.counts().persistCalls, 0);
    assert.equal(r.body.consequential_gate_evidence_available, false);
  });

  it('blocks HEAD change immediately before persistence', async () => {
    const r = await run(
      { authorization: authorization(), context: 'bounded context' },
      { githubOptions: { heads: [HEAD, HEAD, HEAD, OTHER_HEAD] } },
    );
    assert.equal(r.reviewCalls, 1);
    assert.equal(r.body.code, 'PERSISTENCE_HEAD_MISMATCH');
    assert.equal(r.github.counts().persistCalls, 0);
  });

  it('does not retry malformed reviewer output or provider failure and does not persist', async () => {
    for (const impl of [
      async () => ({ verdict: 'APPROVE' }),
      async () => { throw new Error('provider'); },
    ]) {
      const r = await run(
        { authorization: authorization(), context: 'bounded context' },
        { reviewImpl: impl },
      );
      assert.equal(r.reviewCalls, 1);
      assert.equal(r.response.status, 409);
      assert.equal(r.github.counts().persistCalls, 0);
      assert.equal(r.body.next_action, 'STOP_BLOCKED');
    }
  });

  it('blocks persistence failure or read-back mismatch', async () => {
    for (const githubOptions of [{ persistOk: false }, { readBackMatches: false }]) {
      const r = await run(
        { authorization: authorization(), context: 'bounded context' },
        { githubOptions },
      );
      assert.equal(r.reviewCalls, 1);
      assert.equal(r.response.status, 409);
      assert.equal(r.body.code, 'PERSISTENCE_NOT_CONFIRMED');
      assert.equal(r.body.consequential_gate_evidence_available, false);
      assert.equal(r.body.next_action, 'STOP_BLOCKED');
    }
  });

  for (const [field, changed] of [
    ['ready_gate_safe', 'NO'], ['grantId', 'github:issue-comment:9999'],
    ['manifestHash', 'f'.repeat(64)], ['request_hash', 'different'],
    ['run_id', 'different'], ['pr_number', 999], ['reviewed_head_sha', OTHER_HEAD],
    ['envelope_version', 1], ['unexpected', 'ambiguous'],
  ]) {
    it('rejects read-back evidence mutation in ' + field, async () => {
      const mutate = body => {
        const prefix = 'GENESIS_REVIEW_EVIDENCE_V2 ';
        const parsed = JSON.parse(body.slice(prefix.length));
        parsed[field] = changed;
        return prefix + JSON.stringify(parsed);
      };
      const r = await run(
        { authorization: authorization(), context: 'bounded context' },
        { githubOptions: { readBackTransform: mutate } },
      );
      assert.equal(r.reviewCalls, 1);
      assert.equal(r.response.status, 409);
      assert.equal(r.body.code, 'PERSISTENCE_NOT_CONFIRMED');
      assert.equal(r.body.consequential_gate_evidence_available, false);
    });
  }

  it('rejects Grok/xAI self-review before model invocation', async () => {
    const r = await run({
      authorization: authorization({ artifactProducer: 'GROK_XAI' }),
      context: 'bounded context',
    });
    assert.equal(r.body.code, 'REVIEW_SELF_REVIEW_FORBIDDEN');
    assert.equal(r.reviewCalls, 0);
    assert.equal(r.github.counts().persistCalls, 0);
  });

  it('rejects secret-like input and exposes no automatic consequential action fields', async () => {
    const secretContext = `Authorization: Bearer ${'x'.repeat(30)}`;
    const r = await run({ authorization: authorization(), context: secretContext });
    assert.equal(r.body.code, 'REVIEW_SECRET_INPUT_REJECTED');
    assert.equal(r.reviewCalls, 0);
    for (const forbidden of ['merge', 'ready', 'deploy', 'dify', 'cloudflare', 'secrets', 'retry']) {
      assert.equal(Object.hasOwn(r.body, forbidden), false);
    }
  });
});
