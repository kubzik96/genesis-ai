import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrokerDurableObject } from '../src/durable-object.js';
import { budgetLedgerKey } from '../src/budget-ledger.js';
import { createGithubClient } from '../src/github-client.js';
import {
  GROK_EXECUTOR_CONFIG_SHA256,
  XAI_BUDGET_MONTHLY_LIMIT_TICKS,
  XAI_BUDGET_RESERVATION_TICKS,
  XAI_MODEL,
  XAI_RESPONSE_SCHEMA_SHA256,
} from '../src/xai-contract.js';

class MockStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }
  async get(key) { return this.data.get(key); }
  async put(keyOrEntries, value) {
    if (typeof keyOrEntries === 'object' && keyOrEntries !== null && value === undefined) {
      for (const [key, entry] of Object.entries(keyOrEntries)) this.data.set(key, entry);
    } else {
      this.data.set(keyOrEntries, value);
    }
  }
}

const BASE_SHA = 'a'.repeat(40);
const BLOB_SHA = 'b'.repeat(40);
const COMMIT_SHA = 'c'.repeat(40);
const DEPLOYED_SHA = 'd'.repeat(40);
const NOW = '2026-08-12T12:00:00.000Z';

function productionEnv({ github, xaiFetch, overrides = {} }) {
  return {
    GITHUB_PAT: 'github-test',
    XAI_API_KEY: 'xai-test',
    BROKER_SERVICE_TOKEN: 'broker-test',
    GROK_EXECUTOR_LIVE_ENABLED: 'true',
    GENESIS_DEPLOYED_SHA: DEPLOYED_SHA,
    GROK_EXECUTOR_REVIEWED_SHAS: DEPLOYED_SHA,
    GROK_EXECUTOR_MODEL: XAI_MODEL,
    GROK_EXECUTOR_SCHEMA_SHA256: XAI_RESPONSE_SCHEMA_SHA256,
    GROK_EXECUTOR_CONFIG_SHA256,
    _github: github,
    _xaiFetchImpl: xaiFetch,
    _now: NOW,
    ...overrides,
  };
}

function githubMock({ sourceContent = 'line1\nline2\nline3\n' } = {}) {
  const calls = { getRef: 0, getContentAtRef: 0, createRef: 0, updateFile: 0, createPullRequest: 0 };
  return {
    calls,
    async getRef() {
      calls.getRef += 1;
      return { ok: true, status: 200, data: { object: { sha: BASE_SHA } } };
    },
    async getContentAtRef() {
      calls.getContentAtRef += 1;
      return { ok: true, status: 200, data: { sha: BLOB_SHA, encoding: 'base64', content: btoa(sourceContent) } };
    },
    async createRef() {
      calls.createRef += 1;
      return { ok: true, status: 201, data: {} };
    },
    async updateFile() {
      calls.updateFile += 1;
      return { ok: true, status: 200, data: { commit: { sha: COMMIT_SHA } } };
    },
    async createPullRequest(args) {
      calls.createPullRequest += 1;
      return {
        ok: true,
        status: 201,
        data: {
          number: 33,
          html_url: 'https://github.com/kubzik96/genesis-ai/pull/33',
          draft: true,
          head: { ref: args.head, sha: COMMIT_SHA },
          base: { ref: args.base },
        },
      };
    },
  };
}

function xaiResponse(costTicks = 500_000_000) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      summary: 'update',
      changes: [{ path: 'MEMORY.md', expected_blob_sha: BLOB_SHA, new_content: 'line1\nchanged\nline3\n' }],
      self_check: { scope_ok: true },
    }) } }],
    usage: costTicks === undefined ? {} : { cost_in_usd_ticks: costTicks },
  }), { status: 200 });
}

function payload({ key = 'key-prod', runId = 'run-prod' } = {}) {
  return {
    idempotencyKey: key,
    requestHash: `hash-${key}`,
    operation: 'create_branch_commit_draft_pr',
    runId,
    gate: 'G2',
    operationData: {
      runId,
      gate: 'G2',
      confirmedAt: NOW,
      baseSha: BASE_SHA,
      task: { title: 'Update memory', instruction: 'Change one line', allowedFiles: ['MEMORY.md'] },
    },
  };
}

async function invoke(storage, env, body = payload()) {
  const object = new BrokerDurableObject({ storage }, env);
  const response = await object.fetch(new Request('https://do.internal/write', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
  return JSON.parse(await response.text());
}

function writeCalls(github) {
  return github.calls.createRef + github.calls.updateFile + github.calls.createPullRequest;
}

describe('Stage 2 production adapter through Durable Object', () => {
  it('does not expose merge, delete, force-push, workflow, secret, or generic request methods', () => {
    const client = createGithubClient({ pat: 'test', fetchImpl: async () => new Response('{}') });
    for (const forbidden of [
      'merge',
      'mergePullRequest',
      'deleteRef',
      'forcePush',
      'dispatchWorkflow',
      'updateSecret',
      'request',
      'gh',
    ]) {
      assert.equal(forbidden in client, false, `${forbidden} must not be exposed`);
    }
  });

  it('reserves before one mocked xAI boundary call, settles actual ticks, then creates one draft PR', async () => {
    const storage = new MockStorage();
    const github = githubMock();
    let xaiCalls = 0;
    let reservationAtCall = null;
    const env = productionEnv({
      github,
      xaiFetch: async () => {
        xaiCalls += 1;
        reservationAtCall = await storage.get(budgetLedgerKey(new Date(NOW)));
        return xaiResponse(500_000_000);
      },
    });
    const result = await invoke(storage, env);
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW');
    assert.equal(xaiCalls, 1);
    assert.equal(reservationAtCall.spent_ticks, XAI_BUDGET_RESERVATION_TICKS);
    assert.deepEqual(await storage.get(budgetLedgerKey(new Date(NOW))), { spent_ticks: 500_000_000, blocked: false });
    assert.equal(github.calls.createRef, 1);
    assert.equal(github.calls.updateFile, 1);
    assert.equal(github.calls.createPullRequest, 1);
  });

  it('default-off blocks before xAI and GitHub writes', async () => {
    const storage = new MockStorage();
    const github = githubMock();
    let xaiCalls = 0;
    const result = await invoke(storage, productionEnv({
      github,
      xaiFetch: async () => { xaiCalls += 1; return xaiResponse(); },
      overrides: { GROK_EXECUTOR_LIVE_ENABLED: 'false' },
    }));
    assert.equal(result.status, 503);
    assert.equal(result.body.error, 'EXECUTOR_DISABLED');
    assert.equal(xaiCalls, 0);
    assert.equal(writeCalls(github), 0);
  });

  for (const testCase of [
    { name: 'missing cost', cost: null, expectedSpent: XAI_BUDGET_RESERVATION_TICKS },
    { name: 'cost over reservation', cost: XAI_BUDGET_RESERVATION_TICKS + 1, expectedSpent: XAI_BUDGET_RESERVATION_TICKS + 1 },
  ]) {
    it(`${testCase.name} blocks before GitHub writes and requires budget reconciliation`, async () => {
      const storage = new MockStorage();
      const github = githubMock();
      let xaiCalls = 0;
      const env = productionEnv({
        github,
        xaiFetch: async () => { xaiCalls += 1; return xaiResponse(testCase.cost); },
      });
      const first = await invoke(storage, env, payload({ key: `key-${testCase.name}` }));
      assert.equal(first.status, 409);
      assert.equal(first.body.error, 'XAI_BUDGET_RECONCILIATION_REQUIRED');
      assert.equal(writeCalls(github), 0);
      assert.deepEqual(await storage.get(budgetLedgerKey(new Date(NOW))), {
        spent_ticks: testCase.expectedSpent,
        blocked: true,
      });
      const second = await invoke(storage, env, payload({ key: `key-${testCase.name}-2`, runId: 'run-prod-2' }));
      assert.equal(second.status, 503);
      assert.equal(second.body.error, 'XAI_BUDGET_RECONCILIATION_REQUIRED');
      assert.equal(xaiCalls, 1);
    });
  }

  it('monthly ceiling blocks before xAI and GitHub writes', async () => {
    const key = budgetLedgerKey(new Date(NOW));
    const storage = new MockStorage({
      [key]: { spent_ticks: XAI_BUDGET_MONTHLY_LIMIT_TICKS - XAI_BUDGET_RESERVATION_TICKS + 1, blocked: false },
    });
    const github = githubMock();
    let xaiCalls = 0;
    const result = await invoke(storage, productionEnv({
      github,
      xaiFetch: async () => { xaiCalls += 1; return xaiResponse(); },
    }));
    assert.equal(result.status, 429);
    assert.equal(result.body.error, 'XAI_BUDGET_EXCEEDED');
    assert.equal(xaiCalls, 0);
    assert.equal(writeCalls(github), 0);
  });

  it('source ceiling failure releases the reservation and never reaches the network', async () => {
    const storage = new MockStorage();
    const github = githubMock({ sourceContent: 'x'.repeat(6 * 1024 + 1) });
    let xaiCalls = 0;
    const result = await invoke(storage, productionEnv({
      github,
      xaiFetch: async () => { xaiCalls += 1; return xaiResponse(); },
    }));
    assert.equal(result.status, 422);
    assert.equal(result.body.error, 'XAI_CALL_FAILED');
    assert.equal(xaiCalls, 0);
    assert.deepEqual(await storage.get(budgetLedgerKey(new Date(NOW))), { spent_ticks: 0, blocked: false });
    assert.equal(writeCalls(github), 0);
  });

  it('credential-like task input is blocked before xAI and GitHub writes', async () => {
    const storage = new MockStorage();
    const github = githubMock();
    let xaiCalls = 0;
    const body = payload({ key: 'key-secret-input' });
    body.operationData.task.instruction = `Use github_pat_${'A'.repeat(32)}`;
    const result = await invoke(storage, productionEnv({
      github,
      xaiFetch: async () => { xaiCalls += 1; return xaiResponse(); },
    }), body);
    assert.equal(result.status, 422);
    assert.equal(result.body.error, 'XAI_CALL_FAILED');
    assert.equal(xaiCalls, 0);
    assert.equal(writeCalls(github), 0);
    assert.deepEqual(await storage.get(budgetLedgerKey(new Date(NOW))), { spent_ticks: 0, blocked: false });
  });
});
