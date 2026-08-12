import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeGrokDraftPr } from '../src/grok-draft-pr.js';
import { validateGrokDraftPrRequest, validateGrokResponse, enforceHardLimits } from '../src/grok-validate.js';
import { createInMemoryStore } from '../src/memory-store.js';
import { createXaiClient } from '../src/xai-client.js';
import { OP_GROK_DRAFT_PR } from '../src/constants.js';

function mockGitHub(overrides = {}) {
  const state = {
    baseSha: 'abc123base',
    refs: { main: 'abc123base' },
    blobs: {},
    commits: {},
    trees: {},
    pulls: [],
  };
  return {
    state,
    async getRefSha(ref) {
      if (overrides.getRefSha) return overrides.getRefSha(ref);
      if (!state.refs[ref]) throw Object.assign(new Error('Not Found'), { status: 404 });
      return state.refs[ref];
    },
    async getCommit(sha) {
      return { sha, tree: { sha: 'tree-' + sha } };
    },
    async createBlob(content) {
      const sha = 'blob-' + Object.keys(state.blobs).length;
      state.blobs[sha] = content;
      return { sha };
    },
    async createTree(base, tree) {
      const sha = 'tree-' + Object.keys(state.trees).length;
      state.trees[sha] = tree;
      return { sha };
    },
    async createCommit(msg, treeSha, parent) {
      const sha = 'commit-' + Object.keys(state.commits).length;
      state.commits[sha] = { msg, treeSha, parent };
      return { sha };
    },
    async createRef(ref, sha) {
      if (state.refs[ref]) throw Object.assign(new Error('Reference already exists'), { status: 422 });
      state.refs[ref] = sha;
      return { ref: 'refs/heads/' + ref, object: { sha } };
    },
    async createPull({ title, head, base, body, draft }) {
      const number = state.pulls.length + 1;
      const pr = {
        number,
        title,
        head: { ref: head },
        base: { ref: base },
        body,
        draft: !!draft,
        html_url: `https://github.com/kubzik96/genesis-ai/pull/${number}`,
      };
      state.pulls.push(pr);
      return pr;
    },
  };
}

describe('validateGrokDraftPrRequest', () => {
  it('accepts valid body', () => {
    const r = validateGrokDraftPrRequest({
      run_id: 'r1',
      instruction: 'add note',
      branch_name: 'agent/t011-test',
    });
    assert.equal(r.ok, true);
  });

  it('rejects missing run_id', () => {
    const r = validateGrokDraftPrRequest({ instruction: 'x', branch_name: 'b' });
    assert.equal(r.ok, false);
  });

  it('rejects invalid confirmed_at', () => {
    const r = validateGrokDraftPrRequest({
      run_id: 'r1',
      instruction: 'x',
      branch_name: 'b',
      confirmed_at: 'not-a-date',
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('confirmed_at')));
  });
});

describe('validateGrokResponse', () => {
  it('accepts valid MEMORY.md response', () => {
    const r = validateGrokResponse({
      path: 'MEMORY.md',
      content: '# MEMORY\n\n- line\n',
    });
    assert.equal(r.ok, true);
    assert.equal(r.normalized.path, 'MEMORY.md');
  });

  it('rejects non-allowed path', () => {
    const r = validateGrokResponse({ path: 'README.md', content: 'x' });
    assert.equal(r.ok, false);
  });
});

describe('enforceHardLimits', () => {
  it('passes small MEMORY.md with diff_stats', () => {
    const r = enforceHardLimits({
      path: 'MEMORY.md',
      content: 'a\nb\n',
      diff_stats: { changed_lines: 2, diff_bytes: 100 },
    });
    assert.equal(r.ok, true);
  });

  it('rejects too many changed lines', () => {
    const r = enforceHardLimits({
      path: 'MEMORY.md',
      content: 'x',
      diff_stats: { changed_lines: 10, diff_bytes: 50 },
    });
    assert.equal(r.ok, false);
  });

  it('rejects oversize diff_bytes', () => {
    const r = enforceHardLimits({
      path: 'MEMORY.md',
      content: 'x',
      diff_stats: { changed_lines: 1, diff_bytes: 5000 },
    });
    assert.equal(r.ok, false);
  });
});

describe('executeGrokDraftPr', () => {
  let store;
  let github;
  let xai;

  beforeEach(() => {
    store = createInMemoryStore();
    github = mockGitHub();
    xai = createXaiClient({ mock: true });
  });

  const baseBody = {
    run_id: 'run-1',
    instruction: 'append a short note',
    branch_name: 'agent/t011-test-branch',
    request_hash: 'hash-1',
  };

  it('happy path creates draft PR', async () => {
    const result = await executeGrokDraftPr({ requestHash: 'hash-1' }, baseBody, {
      github,
      xai,
      store,
    });
    assert.equal(result.ok, true);
    assert.equal(result.draft, true);
    assert.ok(result.pr_number);
    assert.ok(result.commit_sha);
    assert.equal(result.path, 'MEMORY.md');
    assert.equal(github.state.pulls[0].draft, true);
  });

  it('replays idempotent request', async () => {
    const r1 = await executeGrokDraftPr({ requestHash: 'hash-1' }, baseBody, {
      github,
      xai,
      store,
    });
    const r2 = await executeGrokDraftPr({ requestHash: 'hash-1' }, baseBody, {
      github,
      xai,
      store,
    });
    assert.equal(r1.ok, true);
    assert.equal(r2.replayed, true);
    assert.equal(r2.pr_number, r1.pr_number);
  });

  it('rejects base SHA mismatch', async () => {
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-sha' },
      { ...baseBody, request_hash: 'hash-sha', expected_base_sha: 'wrong' },
      { github, xai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'base_sha_mismatch');
  });

  it('rejects when model returns disallowed file', async () => {
    const badXai = {
      async generateDraftEdit() {
        return { path: 'README.md', content: 'hack' };
      },
    };
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-badfile' },
      { ...baseBody, request_hash: 'hash-badfile' },
      { github, xai: badXai, store }
    );
    assert.equal(result.ok, false);
    assert.ok(['model_validation_failed', 'file_not_allowed', 'hard_limits_exceeded'].includes(result.error));
  });

  it('rejects hard limits on large content without diff_stats', async () => {
    const bigXai = {
      async generateDraftEdit() {
        return {
          path: 'MEMORY.md',
          content: 'x'.repeat(3000),
        };
      },
    };
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-big' },
      { ...baseBody, request_hash: 'hash-big' },
      { github, xai: bigXai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'hard_limits_exceeded');
  });

  it('returns partial_failure_unknown on mid-sequence error', async () => {
    const flaky = mockGitHub();
    const orig = flaky.createCommit.bind(flaky);
    flaky.createCommit = async () => {
      const e = new Error('network');
      e.phase = 'create_commit';
      throw e;
    };
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-partial' },
      { ...baseBody, request_hash: 'hash-partial', branch_name: 'agent/partial' },
      { github: flaky, xai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'partial_failure_unknown');
  });

  it('enforces run bounds', async () => {
    // maxPerRun for OP is 3
    for (let i = 0; i < 3; i++) {
      const r = await executeGrokDraftPr(
        { requestHash: `hash-bound-${i}` },
        { ...baseBody, request_hash: `hash-bound-${i}`, branch_name: `agent/bound-${i}` },
        { github: mockGitHub(), xai, store }
      );
      assert.equal(r.ok, true, `iter ${i}`);
    }
    const over = await executeGrokDraftPr(
      { requestHash: 'hash-bound-over' },
      { ...baseBody, request_hash: 'hash-bound-over', branch_name: 'agent/bound-over' },
      { github: mockGitHub(), xai, store }
    );
    assert.equal(over.ok, false);
    assert.equal(over.error, 'run_bound_exceeded');
  });

  it('never creates non-draft PR', async () => {
    const result = await executeGrokDraftPr({ requestHash: 'hash-draft' }, baseBody, {
      github,
      xai,
      store,
    });
    assert.equal(result.ok, true);
    assert.equal(result.draft, true);
    assert.equal(github.state.pulls.every((p) => p.draft === true), true);
  });

  it('handles xai error', async () => {
    const badXai = {
      async generateDraftEdit() {
        throw new Error('xai down');
      },
    };
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-xai' },
      { ...baseBody, request_hash: 'hash-xai' },
      { github, xai: badXai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'xai_error');
  });

  it('handles github ref error', async () => {
    const badGh = mockGitHub({
      getRefSha: async () => {
        throw Object.assign(new Error('ref missing'), { status: 404 });
      },
    });
    const result = await executeGrokDraftPr(
      { requestHash: 'hash-ref' },
      { ...baseBody, request_hash: 'hash-ref' },
      { github: badGh, xai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'github_ref_error');
  });

  it('detects base sha race', async () => {
    let calls = 0;
    const raceGh = mockGitHub({
      getRefSha: async () => {
        calls += 1;
        return calls === 1 ? 'sha1' : 'sha2';
      },
    });
    // need getCommit etc still work — override only getRefSha
    raceGh.getCommit = async (sha) => ({ sha, tree: { sha: 't' } });
    raceGh.createBlob = async (c) => ({ sha: 'b' });
    raceGh.createTree = async () => ({ sha: 'tr' });
    raceGh.createCommit = async () => ({ sha: 'c' });
    raceGh.createRef = async () => ({});
    raceGh.createPull = async () => ({ number: 1, html_url: 'u', draft: true });

    const result = await executeGrokDraftPr(
      { requestHash: 'hash-race' },
      { ...baseBody, request_hash: 'hash-race' },
      { github: raceGh, xai, store }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'base_sha_race');
  });
});
