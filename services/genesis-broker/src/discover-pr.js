import { COPILOT_BOT, FIXED_BASE_BRANCH, FIXED_FULL_NAME } from './constants.js';
import { parseLinkNext } from './github-client.js';

/**
 * Positively resolve repository full_name from a timeline source.issue.
 * Returns the full_name string only when owner/repo is proven; otherwise null.
 * Never guesses from number, title, or other heuristics.
 */
function resolveRepoFullName(sourceIssue) {
  const repo = sourceIssue?.repository;
  if (!repo || typeof repo !== 'object') return null;
  if (typeof repo.full_name === 'string' && repo.full_name.length > 0) {
    return repo.full_name;
  }
  const owner =
    typeof repo.owner === 'string'
      ? repo.owner
      : repo.owner && typeof repo.owner.login === 'string'
        ? repo.owner.login
        : null;
  const name = typeof repo.name === 'string' ? repo.name : null;
  if (owner && name) return `${owner}/${name}`;
  return null;
}

/**
 * Fail-closed structured PR discovery from Issue timeline cross-referenced events.
 * Returns number | null. Never guesses from title/body/branch names.
 *
 * Uniqueness rules:
 * - Any getPull failure for a structural candidate → null (cannot prove uniqueness).
 * - Cross-reference accepted only with positively confirmed same repository;
 *   missing/incomplete/unrecognized repository on a PR event → null for entire discovery.
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

      const repoName = resolveRepoFullName(sourceIssue);
      if (repoName === null) {
        // PR cross-reference without confirmable repository → fail closed
        return null;
      }
      if (repoName !== FIXED_FULL_NAME) continue;

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
      if (typeof login === 'string' && login.length > 0 && login !== COPILOT_BOT) continue;
      valid.push(prNum);
    }

    if (valid.length === 1) return valid[0];
    return null;
  } catch {
    return null;
  }
}
