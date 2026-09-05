import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleReviewerRuntimeRequest, isReviewerRuntimeRoute } from '../src/index.js';

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

function makeRequest(body, { method = 'POST', path = '/v1/reviews/grok', token = 'svc' } = {}) {
  return new Request(`https://broker.test${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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
} = {}) {
  let headIndex = 0;
  let persistedBody = null;
  let persistCalls = 0;
  let readBackCalls = 0;
  return {
    api: {
      async getPull() {
        const sha = heads[Math.min(headIndex++, heads.length - 1)];
        return { ok: true, status: 200, data: { head: { sha } } };
      },
      async getPullFiles() {
        return {
          ok: true,
          status: 200,
          data: files,
          headers: new Headers(filesNext ? { link: '<https://api.github.com/next>; rel="next"' } : {}),
        };
      },
      async getPullDiff() {
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
            issue_url: `https://api.github.com/repos/kubzik96/genesis-ai/issues/${PR}`,
            body: readBackMatches ? persistedBody : 'GENESIS_REVIEW_EVIDENCE_V1 {"wrong":true}',
          },
        };
      },
    },
    counts: () => ({ persistCalls, readBackCalls, headReads: headIndex }),
  };
}

function env(github, overrides = {}) {
  return {
    BROKER_SERVICE_TOKEN: 'svc',
    GITHUB_PAT: 'pat-for-test-boundary',
    github,
    ...overrides,
  };
}

async function run(body, { githubOptions, reviewImpl, envOverrides } = {}) {
  const gh = makeGithub(githubOptions);
  let reviewCalls = 0;
  const reviewClient = reviewImpl === null ? undefined : {
    async review(input) {
      reviewCalls += 1;
      if (typeof reviewImpl === 'function') return reviewImpl(input);
      return reviewerOutput();
    },
  };
  const response = await handleReviewerRuntimeRequest(
    makeRequest(body),
    env(gh.api, { ...(reviewClient ? { reviewClient } : {}), ...envOverrides }),
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
