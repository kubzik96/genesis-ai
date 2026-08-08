import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/router.js';
import { MemoryBrokerStore } from '../src/memory-store.js';
import { parseLinkNext } from '../src/github-client.js';
import { COPILOT_BOT, FIXED_FULL_NAME } from '../src/constants.js';

function makeRequest(method, path, { headers = {}, body } = {}) {
  const init = { method, headers: new Headers(headers) };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers.set('content-type', 'application/json');
  }
  return new Request(`https://broker.test${path}`, init);
}

function buildGithub({ issue, timelinePages, pulls, pullErrors = {} }) {
  return {
    async getIssue(n) {
      if (!issue || issue.number !== n) {
        return { ok: false, status: 404, data: { message: 'Not Found' } };
      }
      return { ok: true, status: 200, data: issue, headers: new Headers() };
    },
    async getIssueTimeline(_n, { page = 1 } = {}) {
      const pageData = timelinePages[page - 1];
      if (pageData === undefined) {
        return { ok: true, status: 200, data: [], headers: new Headers() };
      }
      const headers = new Headers();
      if (pageData.next) {
        headers.set('link', `<https://api.github.com/x?page=${page + 1}>; rel="next"`);
      }
      return {
        ok: pageData.ok !== false,
        status: pageData.status || 200,
        data: pageData.events || [],
        headers,
      };
    },
    async getPull(n) {
      if (pullErrors[n]) {
        const err = pullErrors[n];
        return {
          ok: false,
          status: err.status || 500,
          data: { message: err.message || 'error' },
          headers: new Headers(),
        };
      }
      const p = pulls[n];
      if (!p) return { ok: false, status: 404, data: { message: 'Not Found' } };
      return { ok: true, status: 200, data: p, headers: new Headers() };
    },
    async getCombinedStatus() {
      return { ok: true, status: 200, data: { state: 'pending' }, headers: new Headers() };
    },
  };
}

const issueBase = {
  number: 42,
  state: 'open',
  title: 'smoke',
  assignees: [],
  html_url: 'https://github.com/kubzik96/genesis-ai/issues/42',
  created_at: '2026-08-07T10:00:00Z',
};

const SAME_REPO_URL = `https://api.github.com/repos/${FIXED_FULL_NAME}`;
const FOREIGN_REPO_URL = 'https://api.github.com/repos/other/repo';

/**
 * Cross-referenced PR event matching documented GitHub REST timeline shape.
 * Uses repository_url only (not repository.full_name).
 */
function xref(prNumber, repositoryUrl = SAME_REPO_URL) {
  const event = {
    event: 'cross-referenced',
    source: {
      type: 'issue',
      issue: {
        number: prNumber,
        pull_request: {
          url: `https://api.github.com/repos/${FIXED_FULL_NAME}/pulls/${prNumber}`,
          html_url: `https://github.com/${FIXED_FULL_NAME}/pull/${prNumber}`,
        },
      },
    },
  };
  if (repositoryUrl !== undefined && repositoryUrl !== null) {
    event.source.issue.repository_url = repositoryUrl;
  }
  return event;
}

/** PR cross-reference with repository_url intentionally absent. */
function xrefMissingRepoUrl(prNumber) {
  return {
    event: 'cross-referenced',
    source: {
      type: 'issue',
      issue: {
        number: prNumber,
        pull_request: {
          url: `https://api.github.com/repos/${FIXED_FULL_NAME}/pulls/${prNumber}`,
          html_url: `https://github.com/${FIXED_FULL_NAME}/pull/${prNumber}`,
        },
      },
    },
  };
}

/** PR cross-reference with malformed repository_url. */
function xrefMalformedRepoUrl(prNumber, repositoryUrl) {
  return {
    event: 'cross-referenced',
    source: {
      type: 'issue',
      issue: {
        number: prNumber,
        pull_request: {
          url: `https://api.github.com/repos/${FIXED_FULL_NAME}/pulls/${prNumber}`,
        },
        repository_url: repositoryUrl,
      },
    },
  };
}

function pullFixture(n, { base = 'main', created_at = '2026-08-07T12:00:00Z', login = COPILOT_BOT, draft = true } = {}) {
  return {
    number: n,
    title: `PR ${n}`,
    state: 'open',
    html_url: `https://github.com/${FIXED_FULL_NAME}/pull/${n}`,
    head: { sha: 'abc' },
    base: { ref: base },
    mergeable: true,
    mergeable_state: 'clean',
    draft,
    user: login === null ? {} : { login },
    created_at,
  };
}

async function statusWith(github) {
  const res = await handleRequest(makeRequest('GET', '/v1/issues/42/status', {
    headers: { authorization: 'Bearer secret' },
  }), {
    BROKER_SERVICE_TOKEN: 'secret',
    GITHUB_PAT: 'pat',
    store: new MemoryBrokerStore(),
    github,
  });
  return { status: res.status, body: JSON.parse(res.body) };
}

async function pullWith(github, n) {
  const res = await handleRequest(makeRequest('GET', `/v1/pulls/${n}`, {
    headers: { authorization: 'Bearer secret' },
  }), {
    BROKER_SERVICE_TOKEN: 'secret',
    GITHUB_PAT: 'pat',
    store: new MemoryBrokerStore(),
    github,
  });
  return { status: res.status, body: JSON.parse(res.body) };
}

describe('read contracts — status pr_number', () => {
  it('no linked PR → pr_number null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [{ event: 'commented' }] }],
      pulls: {},
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
    assert.equal(body.number, 42);
  });

  it('same-repo repository_url → PR found', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7, SAME_REPO_URL)] }],
      pulls: { 7: pullFixture(7) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, 7);
  });

  it('two valid PRs → null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7), xref(8)] }],
      pulls: {
        7: pullFixture(7),
        8: pullFixture(8, { created_at: '2026-08-07T13:00:00Z' }),
      },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('duplicate cross-references of same PR are deduplicated', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7), xref(7), xref(7)] }],
      pulls: { 7: pullFixture(7) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, 7);
  });

  it('PR base not main → excluded', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7)] }],
      pulls: { 7: pullFixture(7, { base: 'develop' }) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('PR created before Issue → excluded', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7)] }],
      pulls: { 7: pullFixture(7, { created_at: '2026-08-07T09:00:00Z' }) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('explicit other author → excluded', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7)] }],
      pulls: { 7: pullFixture(7, { login: 'someone-else' }) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('foreign repository_url → candidate excluded; same-repo still found', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{
        events: [
          null,
          { event: 'labeled' },
          { event: 'cross-referenced', source: { issue: { number: 9 } } },
          xref(10, FOREIGN_REPO_URL),
          xref(7, SAME_REPO_URL),
        ],
      }],
      pulls: { 7: pullFixture(7), 10: pullFixture(10) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, 7);
  });

  it('discovery error → status still 200, pr_number null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ ok: false, status: 500, events: [] }],
      pulls: {},
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('incomplete timeline pagination fail-closed', async () => {
    const github = {
      async getIssue() {
        return { ok: true, status: 200, data: issueBase, headers: new Headers() };
      },
      async getIssueTimeline(_n, { page = 1 } = {}) {
        if (page === 1) {
          const headers = new Headers();
          headers.set('link', '<https://api.github.com/x?page=2>; rel="next"');
          return { ok: true, status: 200, data: [xref(7)], headers };
        }
        return { ok: false, status: 500, data: { message: 'boom' }, headers: new Headers() };
      },
      async getPull() {
        return { ok: true, status: 200, data: pullFixture(7) };
      },
    };
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('two candidates: one valid, getPull of second fails → pr_number null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xref(7), xref(8)] }],
      pulls: {
        7: pullFixture(7),
      },
      pullErrors: {
        8: { status: 500, message: 'upstream error' },
      },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('missing repository_url on PR cross-reference → pr_number null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xrefMissingRepoUrl(7)] }],
      pulls: { 7: pullFixture(7) },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });

  it('malformed repository_url on PR cross-reference → pr_number null', async () => {
    const cases = [
      'not-a-url',
      'https://evil.example/repos/kubzik96/genesis-ai',
      'https://api.github.com/repos/kubzik96/genesis-ai/extra',
      'https://api.github.com/repos/kubzik96',
      'http://api.github.com/repos/kubzik96/genesis-ai',
      '',
    ];
    for (const bad of cases) {
      const github = buildGithub({
        issue: issueBase,
        timelinePages: [{ events: [xrefMalformedRepoUrl(7, bad)] }],
        pulls: { 7: pullFixture(7) },
      });
      const { status, body } = await statusWith(github);
      assert.equal(status, 200, `status for ${bad}`);
      assert.equal(body.pr_number, null, `pr_number for ${bad}`);
    }
  });

  it('missing repository_url among other candidates → entire discovery null', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [{ events: [xrefMissingRepoUrl(7), xref(9)] }],
      pulls: {
        7: pullFixture(7),
        9: pullFixture(9, { created_at: '2026-08-07T13:00:00Z' }),
      },
    });
    const { status, body } = await statusWith(github);
    assert.equal(status, 200);
    assert.equal(body.pr_number, null);
  });
});

describe('read contracts — pulls draft', () => {
  it('draft true → draft true', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [],
      pulls: { 11: pullFixture(11, { draft: true }) },
    });
    const { status, body } = await pullWith(github, 11);
    assert.equal(status, 200);
    assert.equal(body.draft, true);
  });

  it('draft false → draft false', async () => {
    const github = buildGithub({
      issue: issueBase,
      timelinePages: [],
      pulls: { 11: pullFixture(11, { draft: false }) },
    });
    const { status, body } = await pullWith(github, 11);
    assert.equal(status, 200);
    assert.equal(body.draft, false);
  });
});

describe('parseLinkNext', () => {
  it('extracts next URL', () => {
    const h = new Headers();
    h.set('link', '<https://api.github.com/r?page=2>; rel="next", <https://api.github.com/r?page=5>; rel="last"');
    assert.equal(parseLinkNext(h), 'https://api.github.com/r?page=2');
  });

  it('returns null when absent', () => {
    assert.equal(parseLinkNext(new Headers()), null);
  });
});
