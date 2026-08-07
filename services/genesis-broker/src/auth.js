/**
 * Service token authentication (Bearer).
 * Does NOT prove human CEO identity — that is Dify HITL (S-0002 §4.7).
 */
export function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function authenticateService(authorizationHeader, expectedToken) {
  if (!expectedToken) {
    return { ok: false, status: 503, error: 'SERVICE_TOKEN_NOT_CONFIGURED', message: 'BROKER_SERVICE_TOKEN missing' };
  }
  const provided = extractBearerToken(authorizationHeader);
  if (!provided) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization Bearer token' };
  }
  if (!timingSafe.equal(provided, expectedToken)) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Invalid service token' };
  }
  return { ok: true };
}

const timingSafe = {
  equal(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const enc = new TextEncoder();
    const ba = enc.encode(a);
    const bb = enc.encode(b);
    if (ba.length !== bb.length) {
      // Still iterate to prevent timing attacks via length information leakage.
      let diff = ba.length ^ bb.length;
      for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ (bb[i] ?? 0);
      return false;
    }
    let out = 0;
    for (let i = 0; i < ba.length; i++) out |= ba[i] ^ bb[i];
    return out === 0;
  },
};
