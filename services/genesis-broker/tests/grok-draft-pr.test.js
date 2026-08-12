import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleRequest } from '../src/router.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { GROK_DRAFT_PR_LIMITS, IDEM_STATES } from '../src/constants.js';

const BASE_SHA = 'a'.repeat(40);
const BLOB_SHA = 'b'.repeat(40);
const GIT_MAX_HUNK_SECTION_BYTES = 80;
const GIT_HUNK_SECTION_SEPARATOR_BYTES = 1;
const MAX_GIT_HUNK_HEADER_CONTEXT_BYTES = GIT_MAX_HUNK_SECTION_BYTES + GIT_HUNK_SECTION_SEPARATOR_BYTES;
const MAX_GIT_HUNK_HEADER_CONTEXT_BYTES_TOTAL = MAX_GIT_HUNK_HEADER_CONTEXT_BYTES * GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES;

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function gnuUnifiedDiffOracle(oldContent, newContent) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-diff-oracle-'));
  const oldPath = join(dir, 'old.txt');
  const newPath = join(dir, 'new.txt');
  try {
    writeFileSync(oldPath, oldContent, { encoding: 'utf8' });
    writeFileSync(newPath, newContent, { encoding: 'utf8' });
    const result = spawnSync('diff', ['-u', '--label', 'a/MEMORY.md', oldPath, '--label', 'b/MEMORY.md', newPath], { encoding: null });
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`GNU diff failed: ${result.stderr ? result.stderr.toString('utf8') : 'unknown error'}`);
    }

    const output = result.stdout || Buffer.alloc(0);
    return { bytes: output.length, patch: output.toString('utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function gitUnifiedDiffOracle(oldContent, newContent, algorithm = null) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-git-diff-oracle-'));
  const oldPath = join(dir, 'old.txt');
  const newPath = join(dir, 'new.txt');
  try {
    const args = ['diff', '--no-index', '--no-ext-diff', '--no-color', '--no-renames'];
    if (algorithm) args.push(`--diff-algorithm=${algorithm}`);
    args.push('--', oldPath, newPath);
    writeFileSync(oldPath, oldContent, { encoding: 'utf8' });
    writeFileSync(newPath, newContent, { encoding: 'utf8' });
    const result = spawnSync(
      'git',
      args,
      { encoding: null },
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`git diff failed: ${result.stderr ? result.stderr.toString('utf8') : 'unknown error'}`);
    }
    const output = (result.stdout || Buffer.alloc(0)).toString('utf8');
    const lines = output.split('\n');
    if (lines.length >= 2 && lines[0].startsWith('diff --git ')) {
      lines.shift();
    }
    if (lines.length >= 2 && lines[0].startsWith('index ')) {
      lines.shift();
    }
    if (lines.length >= 2 && lines[0].startsWith('--- ') && lines[1].startsWith('+++ ')) {
      lines[0] = '--- a/MEMORY.md';
      lines[1] = '+++ b/MEMORY.md';
    }
    const normalized = lines.join('\n');
    return { bytes: Buffer.byteLength(normalized, 'utf8'), patch: normalized };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function maxGitUnifiedDiffOracleBytes(oldContent, newContent) {
  const algorithms = [null, 'myers', 'minimal', 'patience', 'histogram'];
  let maxBytes = 0;
  for (const algorithm of algorithms) {
    const diff = gitUnifiedDiffOracle(oldContent, newContent, algorithm);
    if (diff.bytes > maxBytes) maxBytes = diff.bytes;
  }
  return maxBytes;
}

function getHunkHeaderSections(patch) {
  return patch
    .split('\n')
    .filter((line) => line.startsWith('@@ '))
    .map((line) => {
      const markerEnd = line.indexOf(' @@');
      if (markerEnd < 0) return '';
      return line.slice(markerEnd + 3);
    });
}

function assertConservativeUnifiedDiffBytes(actualBytes, oracleBytes) {
  assert.ok(actualBytes >= oracleBytes, `expected ${actualBytes} >= oracle ${oracleBytes}`);
  assert.ok(
    actualBytes <= (oracleBytes + MAX_GIT_HUNK_HEADER_CONTEXT_BYTES_TOTAL),
    `expected ${actualBytes} <= oracle ${oracleBytes} + ${MAX_GIT_HUNK_HEADER_CONTEXT_BYTES_TOTAL}`,
  );
}

function makeRequest({ headers = {}, body }) {
  return new Request('https://broker.test/v1/executions/grok/draft-pr', {
    method: 'POST',
    headers: new Headers({
      authorization: ['Bearer', 'secret'].join(' '),
      'content-type': 'application/json',
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

function baseBody(overrides = {}) {
  return {
    operation: 'create_branch_commit_draft_pr',
    run_id: 'run-1',
    gate: 'G2',
    confirmed_at: new Date().toISOString(),
    base_sha: BASE_SHA,
    task: {
      title: 'Update memory',
      instruction: 'Change one line',
      allowed_files: ['MEMORY.md'],
    },
    ...overrides,
  };
}

function githubMock({
  beforeSha = BASE_SHA,
  afterSha = BASE_SHA,
  sourceContent = 'line1\nline2\nline3\n',
  sourceEncoding = 'base64',
  sourceContentBase64 = null,
  createRefStatus = 201,
  updateFileStatus = 200,
  updateFileResponse = null,
  pullStatus = 201,
  pullResponse = null,
  throwAt = null,
} = {}) {
  const calls = { getRef: 0, getContentAtRef: 0, createRef: 0, updateFile: 0, createPullRequest: 0 };
  return {
    __stage1Mock: true,
    calls,
    async getRef() {
      calls.getRef += 1;
      const sha = calls.getRef === 1 ? beforeSha : afterSha;
      return {
        ok: true,
        status: 200,
        data: { object: { sha } },
      };
    },
    async getContentAtRef() {
      calls.getContentAtRef += 1;
      const content = sourceContentBase64 || utf8ToBase64(sourceContent);
      return {
        ok: true,
        status: 200,
        data: { sha: BLOB_SHA, encoding: sourceEncoding, content: sourceEncoding === 'base64' ? content : sourceContent },
      };
    },
    async createRef() {
      calls.createRef += 1;
      if (throwAt === 'createRef') throw new Error('timeout');
      return createRefStatus >= 400
        ? { ok: false, status: createRefStatus, data: { message: 'exists' } }
        : { ok: true, status: createRefStatus, data: {} };
    },
    async updateFile(args) {
      calls.updateFile += 1;
      calls.updateFileArgs = args;
      if (throwAt === 'updateFile') throw new Error('timeout');
      if (updateFileResponse) return updateFileResponse;
      return updateFileStatus >= 400
        ? { ok: false, status: updateFileStatus, data: { message: 'fail' } }
        : { ok: true, status: updateFileStatus, data: { commit: { sha: 'c'.repeat(40) } } };
    },
    async createPullRequest(args) {
      calls.createPullRequest += 1;
      calls.createPullRequestArgs = args;
      if (throwAt === 'createPullRequest') throw new Error('timeout');
      if (pullResponse) return pullResponse;
      return pullStatus >= 400
        ? { ok: false, status: pullStatus, data: { message: 'fail' } }
        : {
          ok: true,
          status: pullStatus,
          data: {
            number: 123,
            html_url: 'https://github.com/kubzik96/genesis-ai/pull/123',
            draft: true,
            head: { ref: args.head, sha: 'c'.repeat(40) },
            base: { ref: args.base },
          },
        };
    },
  };
}

function xaiResponse(newContent = 'line1\nline-two\nline3\n') {
  return {
    summary: 'update',
    self_check: { scope_ok: true },
    changes: [{
      path: 'MEMORY.md',
      expected_blob_sha: BLOB_SHA,
      new_content: newContent,
    }],
  };
}

function envWith({ github, xai }) {
  return {
    BROKER_SERVICE_TOKEN: 'secret',
    GITHUB_PAT: 'pat',
    store: new MemoryBrokerStore(),
    github,
    xai: {
      __stage1Mock: true,
      calls: 0,
      async generateDraftPrChange(...args) {
        xai.calls += 1;
        return xai.fn(...args);
      },
    },
  };
}

describe('POST /v1/executions/grok/draft-pr', () => {
  it('happy path returns safe draft-pr result', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const res = await handleRequest(makeRequest({ headers: { 'idempotency-key': 'k1' }, body: baseBody() }), env);
    const body = JSON.parse(res.body);
    assert.equal(res.status, 200);
    assert.equal(body.status, 'DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW');
    assert.equal(body.branch, 'genesis/grok/run-1');
    assert.equal(body.pr_number, 123);
    assert.deepEqual(body.changed_files, ['MEMORY.md']);
    assertConservativeUnifiedDiffBytes(body.diff_summary.unified_diff_bytes, gnuUnifiedDiffOracle('line1\nline2\nline3\n', 'line1\nline-two\nline3\n').bytes);
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.createPullRequest, 1);
    assert.equal(github.calls.createPullRequestArgs.title, 'grok: run-1');
  });

  it('idempotency replay avoids second xAI/GitHub write', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const req = makeRequest({ headers: { 'idempotency-key': 'k-replay' }, body: baseBody() });
    const req2 = makeRequest({ headers: { 'idempotency-key': 'k-replay' }, body: baseBody() });
    const first = await handleRequest(req, env);
    const second = await handleRequest(req2, env);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.createPullRequest, 1);
  });

  it('rejects stale base sha before xAI', async () => {
    const github = githubMock({ beforeSha: 'c'.repeat(40) });
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-stale-1' }, body: baseBody() }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).error, 'BASE_SHA_MISMATCH');
    assert.equal(xai.calls, 0);
  });

  it('rejects stale base sha after xAI and before writes', async () => {
    const github = githubMock({ afterSha: 'd'.repeat(40) });
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-stale-2' }, body: baseBody() }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).error, 'BASE_SHA_MISMATCH');
    assert.equal(github.calls.createRef, 0);
  });

  it('rejects malformed xAI response and second file', async () => {
    const malformed = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-bad-xai' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => ({ ...xaiResponse(), unknown: true }) },
      }),
    );
    assert.equal(malformed.status, 422);
    assert.equal(JSON.parse(malformed.body).error, 'INVALID_XAI_RESPONSE');

    const secondFile = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-second-file' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: {
          calls: 0,
          fn: async () => ({ ...xaiResponse(), changes: [xaiResponse().changes[0], xaiResponse().changes[0]] }),
        },
      }),
    );
    assert.equal(secondFile.status, 422);
    assert.equal(JSON.parse(secondFile.body).error, 'MULTIPLE_FILES_REJECTED');
  });

  it('requires strict request top-level schema and denies server-controlled fields', async () => {
    const withRepo = await handleRequest(
      makeRequest({
        headers: { 'idempotency-key': 'k-repo' },
        body: baseBody({ repository: 'kubzik96/genesis-ai' }),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(withRepo.status, 400);
    assert.equal(JSON.parse(withRepo.body).error, 'UNKNOWN_FIELD');
  });

  it('enforces changed lines and diff size hard limits', async () => {
    const noChanges = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-no-change' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse('line1\nline2\nline3\n') },
      }),
    );
    assert.equal(noChanges.status, 422);
    assert.equal(JSON.parse(noChanges.body).error, 'NO_CHANGES_DETECTED');

    const tooManyLines = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-lines' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse('a\nb\nc\nd\ne\n') },
      }),
    );
    assert.equal(tooManyLines.status, 422);
    assert.equal(JSON.parse(tooManyLines.body).error, 'CHANGED_LINES_EXCEEDED');

    const hugeLine = 'x'.repeat(2100);
    const tooLargeDiff = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-diff' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse(`line1\n${hugeLine}\nline3\n`) },
      }),
    );
    assert.equal(tooLargeDiff.status, 422);
    assert.equal(JSON.parse(tooLargeDiff.body).error, 'DIFF_SIZE_EXCEEDED');
  });

  it('rejects long-context replacement when actual unified UTF-8 diff exceeds 2 KiB', async () => {
    const longLine = 'x'.repeat(1000);
    const source = [longLine, longLine, longLine, 'target', longLine, longLine, longLine].join('\n') + '\n';
    const github = githubMock({ sourceContent: source });
    const xai = {
      calls: 0,
      fn: async () => xaiResponse([longLine, longLine, longLine, 'target!', longLine, longLine, longLine].join('\n') + '\n'),
    };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-long-context' }, body: baseBody({ run_id: 'run-long-context' }) }),
      envWith({ github, xai }),
    );
    const body = JSON.parse(res.body);
    assert.equal(res.status, 422);
    assert.equal(body.error, 'DIFF_SIZE_EXCEEDED');
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.getRef, 1);
    assert.equal(github.calls.getContentAtRef, 1);
    assert.equal(github.calls.createRef, 0);
    assert.equal(github.calls.updateFile, 0);
    assert.equal(github.calls.createPullRequest, 0);
  });

  it('keeps standard unified diff byte counts stable for nearby and separated hunks', async () => {
    const nearbyOld = 'a\nb\nc\nd\ne\nf\ng\n';
    const nearbyNew = 'a\nB\nc\nC\nd\ne\nf\ng\n';
    const nearby = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-nearby-hunks' }, body: baseBody({ run_id: 'run-nearby-hunks' }) }),
      envWith({
        github: githubMock({ sourceContent: nearbyOld }),
        xai: { calls: 0, fn: async () => xaiResponse(nearbyNew) },
      }),
    );
    const nearbyMaxGitBytes = maxGitUnifiedDiffOracleBytes(nearbyOld, nearbyNew);
    assert.equal(nearby.status, 200);
    assertConservativeUnifiedDiffBytes(JSON.parse(nearby.body).diff_summary.unified_diff_bytes, nearbyMaxGitBytes);

    const separatedOld = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n';
    const separatedNew = '1\n2\n3\n4\nX\n6\n7\n8\n9\n10\n11\n12\n13\n';
    const separated = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-separated-hunks' }, body: baseBody({ run_id: 'run-separated-hunks' }) }),
      envWith({
        github: githubMock({ sourceContent: separatedOld }),
        xai: { calls: 0, fn: async () => xaiResponse(separatedNew) },
      }),
    );
    const separatedMaxGitBytes = maxGitUnifiedDiffOracleBytes(separatedOld, separatedNew);
    assert.equal(separated.status, 200);
    assertConservativeUnifiedDiffBytes(JSON.parse(separated.body).diff_summary.unified_diff_bytes, separatedMaxGitBytes);
  });

  it('counts missing final newline marker bytes in unified diff', async () => {
    const oldContent = 'line1\nline2';
    const noEofNewlineNew = 'line1\nline-two\nline3';
    const withEofNewlineNew = 'line1\nline-two\nline3\n';
    const noEofNewline = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-no-eof-marker' }, body: baseBody({ run_id: 'run-no-eof-marker' }) }),
      envWith({
        github: githubMock({ sourceContent: oldContent }),
        xai: { calls: 0, fn: async () => xaiResponse(noEofNewlineNew) },
      }),
    );
    const noEofNewlineMaxGitBytes = maxGitUnifiedDiffOracleBytes(oldContent, noEofNewlineNew);
    assert.equal(noEofNewline.status, 200);
    assertConservativeUnifiedDiffBytes(JSON.parse(noEofNewline.body).diff_summary.unified_diff_bytes, noEofNewlineMaxGitBytes);

    const withEofNewline = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-with-eof-newline' }, body: baseBody({ run_id: 'run-with-eof-newline' }) }),
      envWith({
        github: githubMock({ sourceContent: oldContent }),
        xai: { calls: 0, fn: async () => xaiResponse(withEofNewlineNew) },
      }),
    );
    const withEofNewlineMaxGitBytes = maxGitUnifiedDiffOracleBytes(oldContent, withEofNewlineNew);
    assert.equal(withEofNewline.status, 200);
    assertConservativeUnifiedDiffBytes(JSON.parse(withEofNewline.body).diff_summary.unified_diff_bytes, withEofNewlineMaxGitBytes);
  });

  it('matches max real-git bytes for separated-hunk and EOF variants across algorithms', async () => {
    const algorithms = [null, 'myers', 'minimal', 'patience', 'histogram'];
    const cases = [
      {
        idempotency: 'k-git-multi-hunk',
        run: 'run-git-multi-hunk',
        oldContent: '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n',
        newContent: '1\n2\nX\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\nY\n13\n14\n',
        expectedHunks: 2,
        expectedChangedLines: 2,
      },
      {
        idempotency: 'k-git-eof-terminated',
        run: 'run-git-eof-terminated',
        oldContent: 'line1\nline2',
        newContent: 'line1\nline-two\nline3\n',
      },
      {
        idempotency: 'k-git-eof-unterminated',
        run: 'run-git-eof-unterminated',
        oldContent: 'line1\nline2\n',
        newContent: 'line1\nline-two\nline3',
      },
    ];
    for (const tc of cases) {
      const gitOracles = algorithms.map((algorithm) => gitUnifiedDiffOracle(tc.oldContent, tc.newContent, algorithm));
      const maxGit = Math.max(...gitOracles.map((oracle) => oracle.bytes));
      if (tc.expectedHunks) {
        for (const [index, oracle] of gitOracles.entries()) {
          const label = algorithms[index] || 'default';
          assert.equal(getHunkHeaderSections(oracle.patch).length, tc.expectedHunks, `${label} must produce separated hunks`);
        }
      }
      const github = githubMock({ sourceContent: tc.oldContent });
      const res = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': tc.idempotency }, body: baseBody({ run_id: tc.run }) }),
        envWith({ github, xai: { calls: 0, fn: async () => xaiResponse(tc.newContent) } }),
      );
      assert.equal(res.status, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.diff_summary.changed_lines <= GROK_DRAFT_PR_LIMITS.MAX_CHANGED_LINES);
      if (tc.expectedChangedLines) assert.equal(body.diff_summary.changed_lines, tc.expectedChangedLines);
      assertConservativeUnifiedDiffBytes(body.diff_summary.unified_diff_bytes, maxGit);
      assert.ok(maxGit <= GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES);
      assert.equal(github.calls.createRef, 1);
      assert.equal(github.calls.updateFile, 1);
      assert.equal(github.calls.createPullRequest, 1);
    }
  });

  it('rejects boundary case where EOF context marker makes unified UTF-8 diff exceed 2 KiB', async () => {
    const trailing = 'x'.repeat(1960);
    const oldContent = `old\nctx1\nctx2\n${trailing}`;
    const newContent = `new\nctx1\nctx2\n${trailing}`;
    const oracle = gnuUnifiedDiffOracle(oldContent, newContent);
    assert.equal(oracle.bytes, 2060);
    assert.match(oracle.patch, /\\ No newline at end of file/);
    const github = githubMock({ sourceContent: oldContent });
    const xai = { calls: 0, fn: async () => xaiResponse(newContent) };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-eof-2k-boundary' }, body: baseBody({ run_id: 'run-eof-2k-boundary' }) }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 422);
    assert.equal(JSON.parse(res.body).error, 'DIFF_SIZE_EXCEEDED');
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.getRef, 1);
    assert.equal(github.calls.getContentAtRef, 1);
    assert.equal(github.calls.createRef, 0);
    assert.equal(github.calls.updateFile, 0);
    assert.equal(github.calls.createPullRequest, 0);
  });

  it('handles EOF-newline-only transitions as real diff changes with oracle-aligned bytes', async () => {
    const removeOld = 'line1\nline2\n';
    const removeNew = 'line1\nline2';
    const removeOracle = gnuUnifiedDiffOracle(removeOld, removeNew);
    assert.match(removeOracle.patch, /\\ No newline at end of file/);
    const removeGithub = githubMock({ sourceContent: removeOld });
    const removeRes = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-eof-remove' }, body: baseBody({ run_id: 'run-eof-remove' }) }),
      envWith({ github: removeGithub, xai: { calls: 0, fn: async () => xaiResponse(removeNew) } }),
    );
    assert.equal(removeRes.status, 200);
    const removeBody = JSON.parse(removeRes.body);
    assertConservativeUnifiedDiffBytes(removeBody.diff_summary.unified_diff_bytes, removeOracle.bytes);
    assert.equal(removeBody.diff_summary.changed_lines, 2);
    assert.equal(base64ToUtf8(removeGithub.calls.updateFileArgs.contentBase64), removeNew);

    const addOld = 'line1\nline2';
    const addNew = 'line1\nline2\n';
    const addOracle = gnuUnifiedDiffOracle(addOld, addNew);
    assert.match(addOracle.patch, /\\ No newline at end of file/);
    const addGithub = githubMock({ sourceContent: addOld });
    const addRes = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-eof-add' }, body: baseBody({ run_id: 'run-eof-add' }) }),
      envWith({ github: addGithub, xai: { calls: 0, fn: async () => xaiResponse(addNew) } }),
    );
    assert.equal(addRes.status, 200);
    const addBody = JSON.parse(addRes.body);
    assertConservativeUnifiedDiffBytes(addBody.diff_summary.unified_diff_bytes, addOracle.bytes);
    assert.equal(addBody.diff_summary.changed_lines, 2);
    assert.equal(base64ToUtf8(addGithub.calls.updateFileArgs.contentBase64), addNew);
  });

  it('rejects append after unterminated final line when GNU-visible unified diff exceeds 2 KiB', async () => {
    const tail = 'x'.repeat(1000);
    const oldContent = `head\n${tail}`;
    const newContent = `head\n${tail}\nz`;
    const oracle = gnuUnifiedDiffOracle(oldContent, newContent);
    assert.equal(oracle.bytes, 2117);
    assert.match(oracle.patch, /\\ No newline at end of file/);
    const github = githubMock({ sourceContent: oldContent });
    const xai = { calls: 0, fn: async () => xaiResponse(newContent) };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-unterminated-append-2k' }, body: baseBody({ run_id: 'run-unterminated-append-2k' }) }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 422);
    assert.equal(JSON.parse(res.body).error, 'DIFF_SIZE_EXCEEDED');
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.getRef, 1);
    assert.equal(github.calls.getContentAtRef, 1);
    assert.equal(github.calls.createRef, 0);
    assert.equal(github.calls.updateFile, 0);
    assert.equal(github.calls.createPullRequest, 0);
  });

  it('counts terminated/unterminated line-identity transitions for append/remove around EOF', async () => {
    const appendOld = 'x\ny';
    const appendNew = 'x\ny\nz';
    const appendOracle = gnuUnifiedDiffOracle(appendOld, appendNew);
    assert.match(appendOracle.patch, /\\ No newline at end of file/);
    const appendRes = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-append-after-unterminated' }, body: baseBody({ run_id: 'run-append-after-unterminated' }) }),
      envWith({ github: githubMock({ sourceContent: appendOld }), xai: { calls: 0, fn: async () => xaiResponse(appendNew) } }),
    );
    assert.equal(appendRes.status, 200);
    const appendBody = JSON.parse(appendRes.body);
    assertConservativeUnifiedDiffBytes(appendBody.diff_summary.unified_diff_bytes, appendOracle.bytes);
    assert.equal(appendBody.diff_summary.changed_lines, 3, 'unterminated y becomes terminated (+line identity change) plus +z');

    const removeOld = 'x\ny\nz';
    const removeNew = 'x\ny';
    const removeOracle = gnuUnifiedDiffOracle(removeOld, removeNew);
    assert.match(removeOracle.patch, /\\ No newline at end of file/);
    const removeRes = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-remove-to-unterminated' }, body: baseBody({ run_id: 'run-remove-to-unterminated' }) }),
      envWith({ github: githubMock({ sourceContent: removeOld }), xai: { calls: 0, fn: async () => xaiResponse(removeNew) } }),
    );
    assert.equal(removeRes.status, 200);
    const removeBody = JSON.parse(removeRes.body);
    assertConservativeUnifiedDiffBytes(removeBody.diff_summary.unified_diff_bytes, removeOracle.bytes);
    assert.equal(removeBody.diff_summary.changed_lines, 3, 'removing z makes y unterminated (+line identity change)');
  });

  it('rejects one-line deletion when git hunk-header context pushes visible unified diff above 2 KiB', async () => {
    const x = 'x'.repeat(980);
    const section = 'q'.repeat(1750);
    const oldContent = `${x}\n${section}\n${x}\nb\nb\n${x}`;
    const newContent = `${x}\n${section}\n${x}\nb\nb\n`;
    const gitOracle = gitUnifiedDiffOracle(oldContent, newContent);
    assert.ok(gitOracle.bytes > 2048);

    const github = githubMock({ sourceContent: oldContent });
    const xai = { calls: 0, fn: async () => xaiResponse(newContent) };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-git-header-2k-boundary' }, body: baseBody({ run_id: 'run-git-header-2k-boundary' }) }),
      envWith({ github, xai }),
    );

    assert.equal(res.status, 422);
    assert.equal(JSON.parse(res.body).error, 'DIFF_SIZE_EXCEEDED');
    assert.equal(xai.calls, 1);
    assert.equal(github.calls.createRef, 0);
    assert.equal(github.calls.updateFile, 0);
    assert.equal(github.calls.createPullRequest, 0);
  });

  it('accepts near-boundary one-line deletion when max Git-visible patch stays <= 2 KiB', async () => {
    const x = 'x'.repeat(940);
    const section = 'q'.repeat(1750);
    const oldContent = `${x}\n${section}\n${x}\nb\nb\n${x}`;
    const newContent = `${x}\n${section}\n${x}\nb\nb\n`;
    const maxGitOracleBytes = maxGitUnifiedDiffOracleBytes(oldContent, newContent);
    assert.ok(maxGitOracleBytes <= 2048);
    assert.ok(maxGitOracleBytes >= 2000);

    const github = githubMock({ sourceContent: oldContent });
    const xai = { calls: 0, fn: async () => xaiResponse(newContent) };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-git-header-2k-near-boundary' }, body: baseBody({ run_id: 'run-git-header-2k-near-boundary' }) }),
      envWith({ github, xai }),
    );

    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.diff_summary.unified_diff_bytes >= maxGitOracleBytes);
    assert.ok(body.diff_summary.unified_diff_bytes <= 2048);
    assert.equal(github.calls.createRef, 1);
    assert.equal(github.calls.updateFile, 1);
    assert.equal(github.calls.createPullRequest, 1);
  });

  it('git-oracle hunk section context is present and capped at 80 UTF-8 bytes', () => {
    const algorithms = [null, 'myers', 'minimal', 'patience', 'histogram'];
    const noSection = '';
    const shortSection = `${'a'.repeat(78)}Ж`;
    const longSection = `${shortSection}Q`;
    const oldFor = (section) => `${section}\nctx1\nctx2\ntarget\ntail\n`;
    const newFor = (section) => `${section}\nctx1\nctx2\ntarget\n`;
    const expectedVisibleSection = ` ${shortSection}`;
    assert.equal(Buffer.byteLength(shortSection, 'utf8'), GIT_MAX_HUNK_SECTION_BYTES);

    for (const algorithm of algorithms) {
      const label = algorithm || 'default';
      const noSectionOracle = gitUnifiedDiffOracle(oldFor(noSection), newFor(noSection), algorithm);
      const shortOracle = gitUnifiedDiffOracle(oldFor(shortSection), newFor(shortSection), algorithm);
      const longOracle = gitUnifiedDiffOracle(oldFor(longSection), newFor(longSection), algorithm);
      const noSectionHeaders = getHunkHeaderSections(noSectionOracle.patch);
      const shortHeaders = getHunkHeaderSections(shortOracle.patch);
      const longHeaders = getHunkHeaderSections(longOracle.patch);

      assert.deepEqual(noSectionHeaders, [''], `${label} no-section control must remain empty`);
      assert.deepEqual(shortHeaders, [expectedVisibleSection], `${label} must select the intended UTF-8 section`);
      assert.deepEqual(longHeaders, [expectedVisibleSection], `${label} must cap the visible section at 80 UTF-8 bytes`);
      assert.equal(Buffer.byteLength(shortHeaders[0].slice(1), 'utf8'), GIT_MAX_HUNK_SECTION_BYTES);
      assert.equal(Buffer.byteLength(shortHeaders[0], 'utf8'), MAX_GIT_HUNK_HEADER_CONTEXT_BYTES);
      assert.equal(shortOracle.bytes - noSectionOracle.bytes, MAX_GIT_HUNK_HEADER_CONTEXT_BYTES);
      assert.equal(longOracle.bytes, shortOracle.bytes);
    }
  });

  it('rejects ambiguous transpositions that can exceed the 2 KiB unified diff limit', async () => {
    const long = 'x'.repeat(1000);
    const cases = [
      {
        idempotency: 'k-amb-transpose-forward',
        run: 'run-amb-transpose-forward',
        oldContent: `${long}\nb\nz`,
        newContent: `b\n${long}\nz`,
      },
      {
        idempotency: 'k-amb-transpose-inverse',
        run: 'run-amb-transpose-inverse',
        oldContent: `b\n${long}\nz`,
        newContent: `${long}\nb\nz`,
      },
    ];
    for (const tc of cases) {
      const oracle = gnuUnifiedDiffOracle(tc.oldContent, tc.newContent);
      assert.ok(oracle.bytes > 0);
      const github = githubMock({ sourceContent: tc.oldContent });
      const res = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': tc.idempotency }, body: baseBody({ run_id: tc.run }) }),
        envWith({ github, xai: { calls: 0, fn: async () => xaiResponse(tc.newContent) } }),
      );
      assert.equal(res.status, 422);
      assert.equal(JSON.parse(res.body).error, 'DIFF_SIZE_EXCEEDED');
      assert.equal(github.calls.createRef, 0);
      assert.equal(github.calls.updateFile, 0);
      assert.equal(github.calls.createPullRequest, 0);
    }
  });

  it('reports conservative unified diff bytes for ambiguous repeated-line and UTF-8 variants', async () => {
    const cases = [
      { id: 'rep-1', oldContent: 'a\nb\na\n', newContent: 'b\na\na\n' },
      { id: 'rep-2', oldContent: 'привет\nмир\nпривет', newContent: 'мир\nпривет\nпривет' },
      { id: 'rep-3', oldContent: 'x\ny\nx', newContent: 'x\nx\ny' },
      { id: 'rep-4', oldContent: 'λ\nβ\nλ\n', newContent: 'β\nλ\nλ\n' },
    ];
    for (const tc of cases) {
      const oracle = gnuUnifiedDiffOracle(tc.oldContent, tc.newContent);
      const github = githubMock({ sourceContent: tc.oldContent });
      const res = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-${tc.id}` }, body: baseBody({ run_id: `run-${tc.id}` }) }),
        envWith({ github, xai: { calls: 0, fn: async () => xaiResponse(tc.newContent) } }),
      );
      const body = JSON.parse(res.body);
      if (res.status === 200) {
        assert.ok(body.diff_summary.unified_diff_bytes >= oracle.bytes);
        assert.ok(body.diff_summary.unified_diff_bytes <= 2048);
        assert.equal(github.calls.createRef, 1);
        assert.equal(github.calls.updateFile, 1);
        assert.equal(github.calls.createPullRequest, 1);
      } else {
        assert.equal(res.status, 422);
        assert.ok(['DIFF_SIZE_EXCEEDED', 'CHANGED_LINES_EXCEEDED'].includes(body.error));
        assert.equal(github.calls.createRef, 0);
        assert.equal(github.calls.updateFile, 0);
        assert.equal(github.calls.createPullRequest, 0);
      }
    }
  });

  it('property-style public-endpoint sweep never accepts below max real-git diff bytes', async () => {
    const sequences = [
      ['a'],
      ['b'],
      ['a', 'a'],
      ['a', 'b'],
      ['b', 'a'],
      ['a', 'b', 'a'],
      ['b', 'a', 'b'],
      ['a', 'b', 'a', 'b'],
    ];
    let checked = 0;
    let accepted = 0;
    for (const oldSeq of sequences) {
      for (const newSeq of sequences) {
        for (const oldNl of [true, false]) {
          for (const newNl of [true, false]) {
            const oldContent = oldSeq.join('\n') + (oldNl ? '\n' : '');
            const newContent = newSeq.join('\n') + (newNl ? '\n' : '');
            const runId = `run-sweep-${checked}`;
            const github = githubMock({ sourceContent: oldContent });
            const res = await handleRequest(
              makeRequest({ headers: { 'idempotency-key': `k-sweep-${checked}` }, body: baseBody({ run_id: runId }) }),
              envWith({ github, xai: { calls: 0, fn: async () => xaiResponse(newContent) } }),
            );
            const body = JSON.parse(res.body);
            if (res.status === 200) {
              accepted += 1;
              const maxGit = maxGitUnifiedDiffOracleBytes(oldContent, newContent);
              assert.ok(
                body.diff_summary.unified_diff_bytes >= maxGit,
                `${runId}: broker undercounted max git diff ${maxGit} (got ${body.diff_summary.unified_diff_bytes})`,
              );
              assert.ok(
                maxGit <= GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES,
                `${runId}: accepted despite max git diff ${maxGit} > ${GROK_DRAFT_PR_LIMITS.MAX_UNIFIED_DIFF_BYTES}`,
              );
            } else {
              assert.ok([422, 409].includes(res.status), `${runId}: unexpected status ${res.status}`);
            }
            checked += 1;
          }
        }
      }
    }
    assert.equal(checked, sequences.length * sequences.length * 4);
    assert.ok(accepted > 0);
  });

  it('rejects oversized model output before branch write path', async () => {
    const github = githubMock();
    const huge = `line1\n${'x'.repeat(70 * 1024)}\nline3\n`;
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-huge' }, body: baseBody() }),
      envWith({
        github,
        xai: { calls: 0, fn: async () => xaiResponse(huge) },
      }),
    );
    assert.equal(res.status, 422);
    assert.equal(JSON.parse(res.body).error, 'CONTENT_TOO_LARGE');
    assert.equal(github.calls.createRef, 0);
  });

  it('rejects binary content and existing branch', async () => {
    const binary = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-bin' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse('line1\n\u0000\nline3\n') },
      }),
    );
    assert.equal(binary.status, 422);
    assert.equal(JSON.parse(binary.body).error, 'BINARY_CONTENT_REJECTED');

    const branchExists = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-branch' }, body: baseBody() }),
      envWith({
        github: githubMock({ createRefStatus: 422 }),
        xai: { calls: 0, fn: async () => xaiResponse() },
      }),
    );
    assert.equal(branchExists.status, 422);
    assert.equal(JSON.parse(branchExists.body).error, 'GITHUB_422');
  });

  it('fails closed when Stage 1 mocks are missing', async () => {
    const github = githubMock();
    const env = {
      BROKER_SERVICE_TOKEN: 'secret',
      GITHUB_PAT: 'pat',
      store: new MemoryBrokerStore(),
      github,
      xai: {
        async generateDraftPrChange() {
          return xaiResponse();
        },
      },
    };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-mocks' }, body: baseBody() }),
      env,
    );
    assert.equal(res.status, 503);
    assert.equal(JSON.parse(res.body).error, 'XAI_NOT_CONFIGURED');
    assert.equal(github.calls.getRef, 0);
  });

  it('supports UTF-8 Cyrillic round-trip and base64-encodes as UTF-8 bytes', async () => {
    const github = githubMock({ sourceContent: 'Привет\nмир\nline3\n' });
    const xai = {
      calls: 0,
      fn: async () => xaiResponse('Привет\nмир!\nline3\n'),
    };
    const res = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-cyr' }, body: baseBody() }),
      envWith({ github, xai }),
    );
    assert.equal(res.status, 200);
    assert.equal(base64ToUtf8(github.calls.updateFileArgs.contentBase64), 'Привет\nмир!\nline3\n');
  });

  it('rejects malformed base64 and invalid UTF-8 from GitHub source', async () => {
    const malformed = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-b64' }, body: baseBody() }),
      envWith({
        github: githubMock({ sourceContentBase64: '%%%not-base64%%%' }),
        xai: { calls: 0, fn: async () => xaiResponse() },
      }),
    );
    assert.equal(malformed.status, 422);
    assert.equal(JSON.parse(malformed.body).error, 'INVALID_BASE64');

    const invalidUtf8 = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-utf8' }, body: baseBody() }),
      envWith({
        github: githubMock({ sourceContentBase64: bytesToBase64([0xc3, 0x28]) }),
        xai: { calls: 0, fn: async () => xaiResponse() },
      }),
    );
    assert.equal(invalidUtf8.status, 422);
    assert.equal(JSON.parse(invalidUtf8.body).error, 'INVALID_UTF8');
  });

  it('rejects invalid self_check and unpaired surrogate content from xAI', async () => {
    const badSelfCheck = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-self-check' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => ({ ...xaiResponse(), self_check: { scope_ok: false } }) },
      }),
    );
    assert.equal(badSelfCheck.status, 422);
    assert.equal(JSON.parse(badSelfCheck.body).error, 'SCOPE_NOT_AFFIRMED');

    const badSurrogate = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-surrogate' }, body: baseBody() }),
      envWith({
        github: githubMock(),
        xai: { calls: 0, fn: async () => xaiResponse(`line1\nbad-\ud800\nline3\n`) },
      }),
    );
    assert.equal(badSurrogate.status, 422);
    assert.equal(JSON.parse(badSurrogate.body).error, 'BINARY_CONTENT_REJECTED');
  });

  it('duplicate run_id write is rate-limited', async () => {
    const github = githubMock();
    const xai = { calls: 0, fn: async () => xaiResponse() };
    const env = envWith({ github, xai });
    const first = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-run-1' }, body: baseBody({ run_id: 'run-dup' }) }),
      env,
    );
    const second = await handleRequest(
      makeRequest({ headers: { 'idempotency-key': 'k-run-2' }, body: baseBody({ run_id: 'run-dup' }) }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(JSON.parse(second.body).error, 'RATE_LIMITED');
  });

  it('rejects expired gate, missing idempotency key, unauthorized path and auth failures', async () => {
    const expired = await handleRequest(
      makeRequest({
        headers: { 'idempotency-key': 'k-expired' },
        body: baseBody({ confirmed_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() }),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(expired.status, 403);
    assert.equal(JSON.parse(expired.body).error, 'GATE_EXPIRED');

    const missingIdem = await handleRequest(
      makeRequest({ body: baseBody() }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(missingIdem.status, 400);
    assert.equal(JSON.parse(missingIdem.body).error, 'MISSING_IDEMPOTENCY_KEY');

    const pathDenied = await handleRequest(
      makeRequest({
        headers: { 'idempotency-key': 'k-path' },
        body: baseBody({
          task: { title: 'T', instruction: 'I', allowed_files: ['ACTIVE.md'] },
        }),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(pathDenied.status, 403);
    assert.equal(JSON.parse(pathDenied.body).error, 'PATH_NOT_ALLOWED');

    const unauthorized = await handleRequest(
      new Request('https://broker.test/v1/executions/grok/draft-pr', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json', 'idempotency-key': 'k-auth' }),
        body: JSON.stringify(baseBody()),
      }),
      envWith({ github: githubMock(), xai: { calls: 0, fn: async () => xaiResponse() } }),
    );
    assert.equal(unauthorized.status, 401);
  });

  it('partial failures after write enter UNKNOWN and block retry', async () => {
    for (const stage of ['createRef', 'updateFile', 'createPullRequest']) {
      const runId = `run-${stage.toLowerCase()}`;
      const store = new MemoryBrokerStore();
      const env = {
        BROKER_SERVICE_TOKEN: 'secret',
        GITHUB_PAT: 'pat',
        store,
        github: githubMock({ throwAt: stage }),
        xai: { __stage1Mock: true, async generateDraftPrChange() { return xaiResponse(); } },
      };
      const key = `k-unknown-${stage}`;
      const first = await handleRequest(makeRequest({ headers: { 'idempotency-key': key }, body: baseBody({ run_id: runId }) }), env);
      assert.equal(first.status, 409, stage);
      assert.equal(JSON.parse(first.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      const idem = store.getIdem(key);
      assert.equal(idem?.state, IDEM_STATES.UNKNOWN);

      const retry = await handleRequest(makeRequest({ headers: { 'idempotency-key': key }, body: baseBody({ run_id: runId }) }), env);
      assert.equal(retry.status, 409, `${stage} retry`);
      assert.equal(JSON.parse(retry.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
    }
  });

  it('post-branch returned 4xx/5xx are authoritative UNKNOWN and block new keys for same run_id', async () => {
    for (const stage of [
      { name: 'commit-4xx', github: githubMock({ updateFileStatus: 422 }) },
      { name: 'commit-5xx', github: githubMock({ updateFileStatus: 500 }) },
      { name: 'pr-4xx', github: githubMock({ pullStatus: 422 }) },
      { name: 'pr-5xx', github: githubMock({ pullStatus: 500 }) },
    ]) {
      const runId = `run-${stage.name}`;
      const env = envWith({ github: stage.github, xai: { calls: 0, fn: async () => xaiResponse() } });
      const first = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-${stage.name}-1` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(first.status, 409, stage.name);
      assert.equal(JSON.parse(first.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      const second = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-${stage.name}-2` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(second.status, 409, `${stage.name} new-key`);
      assert.equal(JSON.parse(second.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(stage.github.calls.createRef, 1);
    }
  });

  it('post-branch thrown timeout is authoritative UNKNOWN and blocks new keys for same run_id', async () => {
    for (const stage of ['updateFile', 'createPullRequest']) {
      const runId = `run-timeout-${stage.toLowerCase()}`;
      const github = githubMock({ throwAt: stage });
      const env = envWith({ github, xai: { calls: 0, fn: async () => xaiResponse() } });
      const first = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-timeout-${stage}-1` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(first.status, 409, stage);
      assert.equal(JSON.parse(first.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      const second = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-timeout-${stage}-2` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(second.status, 409, `${stage} new-key`);
      assert.equal(JSON.parse(second.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(github.calls.createRef, 1);
    }
  });

  it('malformed post-branch success payloads become UNKNOWN and block retries', async () => {
    const invalidCases = [
      {
        name: 'missing-commit-sha',
        github: githubMock({ updateFileResponse: { ok: true, status: 200, data: { commit: {} } } }),
      },
      {
        name: 'invalid-commit-sha',
        github: githubMock({ updateFileResponse: { ok: true, status: 200, data: { commit: { sha: 'xyz' } } } }),
      },
      {
        name: 'missing-pr-number',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'zero-pr-number',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 0, html_url: 'https://github.com/kubzik96/genesis-ai/pull/0', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'negative-pr-number',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: -2, html_url: 'https://github.com/kubzik96/genesis-ai/pull/-2', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'non-integer-pr-number',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 1.5, html_url: 'https://github.com/kubzik96/genesis-ai/pull/1.5', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'string-pr-number',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: '123', html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'wrong-pr-url',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://evil.example/pull/123', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'wrong-head-ref',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'other/branch', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'missing-head-sha',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'genesis/grok/run-1' }, base: { ref: 'main' } } } }),
      },
      {
        name: 'wrong-head-sha',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'd'.repeat(40) }, base: { ref: 'main' } } } }),
      },
      {
        name: 'wrong-base-ref',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: true, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'develop' } } } }),
      },
      {
        name: 'draft-false',
        github: githubMock({ pullResponse: { ok: true, status: 201, data: { number: 123, html_url: 'https://github.com/kubzik96/genesis-ai/pull/123', draft: false, head: { ref: 'genesis/grok/run-1', sha: 'c'.repeat(40) }, base: { ref: 'main' } } } }),
      },
    ];
    for (const testCase of invalidCases) {
      const runId = 'run-1';
      const env = envWith({ github: testCase.github, xai: { calls: 0, fn: async () => xaiResponse() } });
      const first = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-${testCase.name}-1` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(first.status, 409, testCase.name);
      assert.equal(JSON.parse(first.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      const second = await handleRequest(
        makeRequest({ headers: { 'idempotency-key': `k-${testCase.name}-2` }, body: baseBody({ run_id: runId }) }),
        env,
      );
      assert.equal(second.status, 409, `${testCase.name} new-key`);
      assert.equal(JSON.parse(second.body).error, 'BLOCKED_RECONCILIATION_REQUIRED');
      assert.equal(testCase.github.calls.createRef, 1, `${testCase.name} no second write`);
    }
  });
});
