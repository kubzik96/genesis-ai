const HIGH_CONFIDENCE_SECRET_PATTERNS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxai-[A-Za-z0-9_-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{20,}/i,
]);

/**
 * Fail-closed, high-confidence credential detector for the Grok boundary.
 * It intentionally returns only a boolean so the matched value is never logged.
 */
export function containsCredentialLikeValue(value) {
  if (typeof value !== 'string') return false;
  return HIGH_CONFIDENCE_SECRET_PATTERNS.some((pattern) => pattern.test(value));
}
