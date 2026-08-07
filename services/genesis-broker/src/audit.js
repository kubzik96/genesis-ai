/**
 * Safe audit event — never log Authorization, PAT, service tokens, or file secrets.
 */
const REDACT_KEYS = new Set([
  'authorization',
  'Authorization',
  'token',
  'pat',
  'password',
  'secret',
  'GITHUB_PAT',
  'BROKER_SERVICE_TOKEN',
  'api_key',
  'apiKey',
]);

export function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^gh[pousr]_[A-Za-z0-9_]+/.test(value)) return '[REDACTED]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        REDACT_KEYS.has(k) ||
        /(?:^|_)(?:token|secret|password|authorization|pat|api_?key)(?:$|_)/i.test(k)
      ) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function auditEvent(fields) {
  const event = {
    timestamp: new Date().toISOString(),
    ...redact(fields),
  };
  console.log(JSON.stringify({ audit: event }));
  return event;
}
