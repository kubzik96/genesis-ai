import { COPILOT_BOT, FIXED_BASE_BRANCH, FIXED_OWNER, FIXED_REPO, GITHUB_API_HOST } from './constants.js';

/**
 * Minimal GitHub API client. Host and repo are fixed — no generic proxy.
 * Inject `fetchImpl` for tests.
 */
export function createGithubClient({ pat, fetchImpl = fetch }) {
  if (!pat) {
    return null;
  }

  async function gh(method, path, body) {
    const url = `https://${GITHUB_API_HOST}${path}`;
    const res = await fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
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
    async getContent(path) {
      const encoded = path
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/contents/${encoded}?ref=${FIXED_BASE_BRANCH}`);
    },

    async createIssue({ title, body, labels }) {
      return gh('POST', `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues`, {
        title,
        body,
        labels: labels || [],
      });
    },

    /**
     * Path B2: Issue Assignment API — assign Copilot bot (single call).
     */
    async assignCopilot(issueNumber) {
      return gh(
        'POST',
        `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues/${issueNumber}/assignees`,
        { assignees: [COPILOT_BOT] },
      );
    },

    async getIssue(issueNumber) {
      return gh('GET', `/repos/${FIXED_OWNER}/${FIXED_REPO}/issues/${issueNumber}`);
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
  };
}

/** Map GitHub HTTP status to safe client error without leaking headers/tokens. */
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
