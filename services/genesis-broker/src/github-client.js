import { COPILOT_BOT, FIXED_BASE_BRANCH, FIXED_FULL_NAME, FIXED_OWNER, FIXED_REPO, GITHUB_API_HOST } from './constants.js';

/**
 * Minimal GitHub API client. Host and repo are fixed — no generic proxy.
 * Inject `fetchImpl` for tests.
 */
export function createGithubClient({ pat, fetchImpl = fetch }) {
  if (!pat) {
    return null;
  }

  async function gh(method, path, body, accept) {
    const url = `https://${GITHUB_API_HOST}${path}`;
    const res = await fetchImpl(url, {
      method,
      headers: {
        Accept: accept || 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'genesis-broker-mvp',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text?.slice?.(0, 200) };
    }
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  return {
    async getContent(path, ref = FIXED_BASE_BRANCH) {
      const encoded = path
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/contents/${encoded}?ref=${encodeURIComponent(ref)}`);
    },

    async createIssue({ title, body, labels }) {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues`, {
        title,
        body,
        labels: labels || [],
      });
    },

    async assignCopilot(issueNumber) {
      return gh(
        'POST',
        `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues/${issueNumber}/assignees`,
        {
          assignees: [COPILOT_BOT],
          agent_assignment: {
            target_repo: FIXED_FULL_NAME,
            base_branch: FIXED_BASE_BRANCH,
            custom_instructions: '',
            custom_agent: '',
            model: '',
          },
        },
      );
    },

    async getIssue(issueNumber) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues/${issueNumber}`);
    },

    async getIssueTimeline(issueNumber, { page = 1, perPage = 100 } = {}) {
      const q = `per_page=${perPage}&page=${page}`;
      return gh(
        'GET',
        `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues/${issueNumber}/timeline?${q}`,
      );
    },

    async getPull(pullNumber) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/pulls/${pullNumber}`);
    },

    async getPullFiles(pullNumber) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/pulls/${pullNumber}/files`);
    },

    async getPullDiff(pullNumber) {
      const url = `https://${GITHUB_API_HOST}/repos/${FIXED_OWNER}/${FIXED_REPO}/pulls/${pullNumber}`;
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3.diff',
          Authorization: `Bearer ${pat}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'genesis-broker-mvp',
        },
      });
      const text = await res.text();
      return { status: res.status, ok: res.ok, data: text, headers: res.headers };
    },

    async getCombinedStatus(ref) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/commits/${encodeURIComponent(ref)}/status`);
    },

    async getRef(ref) {
      const encoded = encodeURIComponent(ref.startsWith('refs/') ? ref : `heads/${ref}`);
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/ref/${encoded}`);
    },

    async getCommit(sha) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/commits/${encodeURIComponent(sha)}`);
    },

    async createBlob(content, encoding = 'utf-8') {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/blobs`, {
        content,
        encoding,
      });
    },

    async createTree(baseTreeSha, tree) {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/trees`, {
        base_tree: baseTreeSha,
        tree,
      });
    },

    async createCommit({ message, tree, parents }) {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/commits`, {
        message,
        tree,
        parents: parents || [],
      });
    },

    async createRef(ref, sha) {
      const fullRef = ref.startsWith('refs/') ? ref : `refs/heads/${ref}`;
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/git/refs`, {
        ref: fullRef,
        sha,
      });
    },

    async createPull({ title, head, base, body, draft }) {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/pulls`, {
        title,
        head,
        base,
        body: body || '',
        draft: draft === true,
      });
    },
  };
}

export function mapGithubError(status, data) {
  const message =
    (data && (data.message || data.error)) ||
    (status === 401
      ? 'GitHub unauthorized'
      : status === 403
        ? 'GitHub forbidden'
        : status === 422
          ? 'GitHub validation failed'
          : status >= 500
            ? 'GitHub upstream error'
            : 'GitHub request failed');
  return {
    status: status >= 400 ? status : 502,
    error: `GITHUB_${status}`,
    message: String(message).slice(0, 300),
  };
}

export function parseLinkNext(headers) {
  if (!headers || typeof headers.get !== 'function') return null;
  const link = headers.get('link') || headers.get('Link');
  if (!link || typeof link !== 'string') return null;
  for (const part of link.split(',')) {
    const m = part.trim().match(/^<([^>]+)>\s*;\s*rel="?next"?/i);
    if (m) return m[1];
  }
  return null;
}
