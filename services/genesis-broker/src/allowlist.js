/**
 * Route and path allowlists for Genesis Broker.
 * Fail-closed: anything not listed is rejected.
 */

export const ALLOWED_ROUTES = new Set([
  'GET /v1/health',
  'POST /v1/context/read',
  'POST /v1/issues',
  'POST /v1/issues/{n}/assign-copilot',
  'GET /v1/issues/{n}/status',
  'GET /v1/pulls/{n}',
  'GET /v1/pulls/{n}/diff',
  'POST /v1/executions/grok/draft-pr',
]);

/** Allowed file paths for Grok draft-PR edits (hard limit). */
const GROK_ALLOWED_FILES = new Set(['MEMORY.md']);

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isAllowedGrokFile(path) {
  if (typeof path !== 'string') return false;
  const normalized = path.replace(/^\.\//, '').replace(/\\/g, '/');
  return GROK_ALLOWED_FILES.has(normalized);
}

/**
 * @param {string} method
 * @param {string} pathname
 * @returns {boolean}
 */
export function isAllowedRoute(method, pathname) {
  const key = `${method.toUpperCase()} ${pathname}`;
  if (ALLOWED_ROUTES.has(key)) return true;
  // parameterized
  if (method === 'POST' && /^\/v1\/issues\/\d+\/assign-copilot$/.test(pathname)) return true;
  if (method === 'GET' && /^\/v1\/issues\/\d+\/status$/.test(pathname)) return true;
  if (method === 'GET' && /^\/v1\/pulls\/\d+$/.test(pathname)) return true;
  if (method === 'GET' && /^\/v1\/pulls\/\d+\/diff$/.test(pathname)) return true;
  return false;
}
