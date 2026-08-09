import { COPILOT_PR_AUTHOR_LOGINS, FIXED_BASE_BRANCH, FIXED_OWNER, FIXED_REPO, GITHUB_API_HOST } from './constants.js';
import { parseLinkNext } from './github-client.js';

/**
 * Positively confirm repository from documented REST timeline field
 * source.issue.repository_url (e.g. https://api.github.com/repos/kubzik96/genesis-ai).
 *
 * Structural parse only: exact host api.github.com and exact path /repos/{owner}/{repo}.
 * Returns:
 *   'same'    — proven FIXED_OWNER/FIXED_REPO
 *   'foreign' — proven different owner/repo
 *   null      — missing, malformed, or unconfirmable
 *
 * Never uses source.issue.repository (not a guaranteed REST timeline field).
 * Never guesses from number, title, or other heuristics.
 */
function classifyRepositoryUrl(repositoryUrl) {
  if (typeof repositoryUrl !== 'string' || repositoryUrl.length === 0) {
    return null;
  }
  let url;
  try {
    url = new URL(repositoryUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== GITHUB_API_HOST) return null;
  // Exact path: /repos/{owner}/{repo} — no trailing slash, no extra segments
  const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const owner = decodeURIComponent(m[1]);
  const repo = decodeURIComponent(m[2]);
  if (!owner || !repo) return null;
  if (owner === FIXED_OWNER && repo === FIXED_REPO) return 'same';
  return 'foreign';
}

/**
 * Fail-closed structured PR discovery from Issue timeline cross-referenced events.
 * Returns number | null. Never guesses from title/body/branch names.
 *
 * Uniqueness rules:
 * - Any getPull failure for a structural candidate → null (cannot prove uniqueness).
 * - Cross-reference accepted only with positively confirmed same repository via
 *   source.issue.repository_url; missing/malformed/unconfirmable → null for entire discovery.
 * - Foreign repository_url → skip candidate only.
 * - PR author login is required and must be in COPILOT_PR_AUTHOR_LOGINS;
 *   missing/empty/non-string login → entire discovery null;
 *   non-allowlisted non-empty login → skip that candidate only.
 */
export async function discoverLinkedPullNumber(github, issueNumber, issueCreatedAt) {
  try {
    const events = [];
    let page = 1;
    const maxPages = 20;
    while (page <= maxPages) {
      const tl = await github.getIssueTimeline(issueNumber, { page, perPage: 100 });
      if (!tl.ok) {
        return null;
      }
      const batch = Array.isArray(tl.data) ? tl.data : [];
      events.push(...batch);
      const next = parseLinkNext(tl.headers);
      if (!next) break;
      page += 1;
      if (page > maxPages) {
        return null;
      }
    }

    const candidateNums = new Set();
    for (const ev of events) {
      if (!ev || ev.event !== 'cross-referenced') continue;
      const sourceIssue = ev.source?.issue;
      if (!sourceIssue || !sourceIssue.pull_request) continue;

      const classification = classifyRepositoryUrl(sourceIssue.repository_url);
      if (classification === null) {
        // PR cross-reference without confirmable repository_url → fail closed
        return null;
      }
      if (classification === 'foreign') continue;

      const n = Number(sourceIssue.number);
      if (!Number.isFinite(n) || n <= 0) continue;
      candidateNums.add(n);
    }

    if (candidateNums.size === 0) return null;

    const issueTs = issueCreatedAt ? Date.parse(issueCreatedAt) : NaN;
    const valid = [];
    for (const prNum of candidateNums) {
      const pr = await github.getPull(prNum);
      // Any getPull failure for a structural candidate invalidates uniqueness proof
      if (!pr.ok || !pr.data) {
        return null;
      }
      const data = pr.data;
      if (data.base?.ref !== FIXED_BASE_BRANCH) continue;
      const prTs = data.created_at ? Date.parse(data.created_at) : NaN;
      if (!Number.isFinite(issueTs) || !Number.isFinite(prTs) || !(prTs > issueTs)) continue;
      const login = data.user?.login;
      // Official Copilot identity must be positively proven; missing/empty/non-string login
      // makes uniqueness of an official Copilot PR unprovable → fail closed for entire discovery.
      if (typeof login !== 'string' || login.length === 0) {
        return null;
      }
      if (!COPILOT_PR_AUTHOR_LOGINS.includes(login)) continue;
      valid.push(prNum);
    }

    if (valid.length === 1) return valid[0];
    return null;
  } catch {
    return null;
  }
}
