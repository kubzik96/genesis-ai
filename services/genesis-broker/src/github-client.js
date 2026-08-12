/**
 * GitHub REST client for Genesis Broker.
 * All methods are pure HTTP wrappers; no side-effects beyond the call.
 */

const API = 'https://api.github.com';

/**
 * @param {object} opts
 * @param {string} opts.token
 * @param {string} opts.owner
 * @param {string} opts.repo
 */
export function createGitHubClient({ token, owner, repo }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'genesis-broker',
  };

  async function request(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data?.message || `GitHub ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    async getRefSha(ref) {
      const data = await request('GET', `/repos/${owner}/${repo}/git/ref/heads/${ref}`);
      return data.object.sha;
    },

    async getBlob(sha) {
      return request('GET', `/repos/${owner}/${repo}/git/blobs/${sha}`);
    },

    async createBlob(content, encoding = 'utf-8') {
      return request('POST', `/repos/${owner}/${repo}/git/blobs`, { content, encoding });
    },

    async getCommit(sha) {
      return request('GET', `/repos/${owner}/${repo}/git/commits/${sha}`);
    },

    async createTree(baseTreeSha, tree) {
      return request('POST', `/repos/${owner}/${repo}/git/trees`, {
        base_tree: baseTreeSha,
        tree,
      });
    },

    async createCommit(message, treeSha, parentSha) {
      return request('POST', `/repos/${owner}/${repo}/git/commits`, {
        message,
        tree: treeSha,
        parents: [parentSha],
      });
    },

    async createRef(ref, sha) {
      return request('POST', `/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${ref}`,
        sha,
      });
    },

    async createPull({ title, head, base, body, draft = true }) {
      return request('POST', `/repos/${owner}/${repo}/pulls`, {
        title,
        head,
        base,
        body: body || '',
        draft: !!draft,
      });
    },

    async getFileContent(path, ref) {
      return request('GET', `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    },
  };
}
