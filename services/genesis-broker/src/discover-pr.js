import { COPILOT_BOT, FIXED_BASE_BRANCH, FIXED_FULL_NAME } from './constants.js';
import { parseLinkNext } from './github-client.js';

/**
 * Fail-closed structured PR discovery from Issue timeline cross-referenced events.
 * Returns number | null. Never guesses from title/body/branch names.
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
      const repoFull = sourceIssue.repository?.full_name;
      const repoName = typeof repoFull === 'string' && repoFull.length > 0
        ? repoFull
        : (sourceIssue.repository?.owner && sourceIssue.repository?.name
          ? `${sourceIssue.repository.owner.login || sourceIssue.repository.owner}/${sourceIssue.repository.name}`
          : null);
      if (repoName && repoName !== FIXED_FULL_NAME) continue;
      const n = Number(sourceIssue.number);
      if (!Number.isFinite(n) || n <= 0) continue;
      candidateNums.add(n);
    }

    if (candidateNums.size === 0) return null;

    const issueTs = issueCreatedAt ? Date.parse(issueCreatedAt) : NaN;
    const valid = [];
    for (const prNum of candidateNums) {
      const pr = await github.getPull(prNum);
      if (!pr.ok || !pr.data) continue;
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
