import { CONTEXT_ALLOWLIST, FIXED_FULL_NAME, FIXED_OWNER, FIXED_REPO, GITHUB_API_HOST } from './constants.js';

export function isAllowedContextPath(path) {
  if (typeof path !== 'string') return false;
  const normalized = path.replace(/^\/+/, '');
  return CONTEXT_ALLOWLIST.includes(normalized);
}

export function assertRepoIsFixed(owner, repo) {
  if (owner !== FIXED_OWNER || repo !== FIXED_REPO) {
    return { ok: false, status: 403, error: 'REPO_NOT_ALLOWED', message: `Only ${FIXED_FULL_NAME} is allowed` };
  }
  return { ok: true };
}

export function assertGithubHost(hostname) {
  if (hostname !== GITHUB_API_HOST) {
    return { ok: false, status: 403, error: 'HOST_NOT_ALLOWED', message: `Only ${GITHUB_API_HOST} is allowed` };
  }
  return { ok: true };
}

/** Reject unknown routes early — no generic proxy. */
export const ALLOWED_ROUTES = Object.freeze([
  { method: 'GET', pattern: /^\/v1\/health$/ },
  { method: 'POST', pattern: /^\/v1\/context\/read$/ },
  { method: 'POST', pattern: /^\/v1\/issues$/ },
  { method: 'POST', pattern: /^\/v1\/issues\/\d+\/assign-copilot$/ },
  { method: 'GET', pattern: /^\/v1\/issues\/\d+\/status$/ },
  { method: 'GET', pattern: /^\/v1\/pulls\/\d+$/ },
  { method: 'GET', pattern: /^\/v1\/pulls\/\d+\/diff$/ },
]);

export function matchRoute(method, pathname) {
  for (const route of ALLOWED_ROUTES) {
    if (route.method === method && route.pattern.test(pathname)) {
      return true;
    }
  }
  return false;
}
