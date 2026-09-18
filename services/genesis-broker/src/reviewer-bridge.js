const ENCODER = new TextEncoder();
const CONFIG_KEYS = ['producerAppId', 'installationId', 'eventName', 'eventAction'];
const BRIDGE_KEYS = ['version', 'commandId', 'commandHash', 'deliveryId', ...CONFIG_KEYS];
const COMMAND_KEYS = ['version', 'action', 'commandId', 'deliveryId', 'repository', 'prNumber', 'expectedHeadSha', 'grantId', 'manifestHash', 'issuanceDigest', ...CONFIG_KEYS];
const HASH = /^[a-f0-9]{64}$/;
const ASCII = (value) => typeof value === 'string' && !/[^\x20-\x7e]/.test(value);
const POSITIVE = (value) => Number.isSafeInteger(value) && value > 0;
const CLOSED = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

// Scan the token stream before JSON.parse can erase duplicate member evidence.
// String primitives may be decoded for escaped-key comparison; objects are not built.
export function parseStrictJsonBytes(bytes) {
  const invalid = () => { throw new Error('Invalid JSON bytes'); };
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) invalid();
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) invalid();
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { invalid(); }
  let at = 0;
  const space = () => { while (/[\x20\x09\x0a\x0d]/.test(source[at] ?? '\u0000')) at += 1; };
  const string = () => {
    const start = at;
    if (source[at++] !== '"') invalid();
    while (at < source.length) {
      const char = source[at++];
      if (char === '"') {
        try { return JSON.parse(source.slice(start, at)); } catch { invalid(); }
      }
      if (char.charCodeAt(0) < 0x20) invalid();
      if (char === '\\') {
        const escape = source[at++];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(at, at + 4))) invalid();
          at += 4;
        } else if (!['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(escape)) invalid();
      }
    }
    invalid();
  };
  const value = (depth) => {
    if (depth > 64) invalid();
    space();
    if (source[at] === '"') { string(); return; }
    if (source[at] === '{') {
      at += 1; space();
      const seen = new Set();
      if (source[at] === '}') { at += 1; return; }
      while (true) {
        space();
        const key = string();
        if (seen.has(key)) invalid();
        seen.add(key); space();
        if (source[at++] !== ':') invalid();
        value(depth + 1); space();
        const end = source[at++];
        if (end === '}') return;
        if (end !== ',') invalid();
      }
    }
    if (source[at] === '[') {
      at += 1; space();
      if (source[at] === ']') { at += 1; return; }
      while (true) {
        value(depth + 1); space();
        const end = source[at++];
        if (end === ']') return;
        if (end !== ',') invalid();
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(source.slice(at));
    if (!token) invalid();
    at += token[0].length;
  };
  value(0); space();
  if (at !== source.length) invalid();
  try { return JSON.parse(source); } catch { invalid(); }
}

const canonical = (value) => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])));
const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', ENCODER.encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join('');
const denied = (code = 'REVIEW_BRIDGE_INVALID') => ({
  ok: false, status: 409,
  body: { ok: false, code, verdict: 'BLOCKED', reviewed_head_sha: null, head_confirmed: 'NO', scope: 'NOT_CLEAN', findings: [], ready_gate_safe: 'NO', consequential_gate_evidence_available: false, next_action: 'STOP_BLOCKED' },
});

function configuration(env) {
  if (env?.GITHUB_REVIEW_BRIDGE_ENABLED !== 'true' || typeof env.GITHUB_REVIEW_BRIDGE_CONFIG !== 'string') return null;
  try {
    const config = parseStrictJsonBytes(ENCODER.encode(env.GITHUB_REVIEW_BRIDGE_CONFIG));
    if (!CLOSED(config, CONFIG_KEYS) || !POSITIVE(config.producerAppId) || !POSITIVE(config.installationId)
      || ![config.eventName, config.eventAction].every((value) => ASCII(value) && /^[a-z][a-z0-9_]{0,63}$/.test(value))) return null;
    return config;
  } catch { return null; }
}

function validCommand(command, authorization, config) {
  return CLOSED(command, COMMAND_KEYS)
    && Object.values(command).every((value) => typeof value !== 'string' || ASCII(value))
    && command.version === 'genesis.review-command.v1' && command.action === 'request_review'
    && command.repository === 'kubzik96/genesis-ai'
    && typeof command.commandId === 'string' && /^github-review-command:[1-9][0-9]{0,19}$/.test(command.commandId)
    && typeof command.deliveryId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(command.deliveryId)
    && POSITIVE(command.prNumber) && POSITIVE(command.producerAppId) && POSITIVE(command.installationId)
    && typeof command.expectedHeadSha === 'string' && /^[a-f0-9]{40}$/.test(command.expectedHeadSha)
    && typeof command.grantId === 'string' && /^github:issue-comment:[1-9][0-9]*$/.test(command.grantId)
    && typeof command.manifestHash === 'string' && HASH.test(command.manifestHash)
    && typeof command.issuanceDigest === 'string' && HASH.test(command.issuanceDigest)
    && CONFIG_KEYS.every((key) => command[key] === config[key])
    && ['repository', 'prNumber', 'expectedHeadSha', 'grantId', 'manifestHash', 'issuanceDigest'].every((key) => command[key] === authorization?.[key]);
}

export async function validateBridgeAdmission(body, env) {
  const config = configuration(env);
  if (!config) return denied('REVIEW_BRIDGE_DISABLED_OR_UNCONFIGURED');
  if (!CLOSED(body, ['command', 'authorization', 'context', 'run_id']) || typeof body.command !== 'string'
    || typeof body.context !== 'string' || !body.context.trim()
    || typeof body.run_id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,80}$/.test(body.run_id)) return denied();
  try {
    const command = parseStrictJsonBytes(ENCODER.encode(body.command));
    if (!validCommand(command, body.authorization, config) || canonical(command) !== body.command) return denied();
    const bridge = Object.freeze({ version: 'genesis.review-bridge.v1', commandId: command.commandId,
      commandHash: await digest(body.command), deliveryId: command.deliveryId,
      ...Object.fromEntries(CONFIG_KEYS.map((key) => [key, command[key]])) });
    return { ok: true, value: { authorization: body.authorization, context: body.context, runId: body.run_id, bridge, command: Object.freeze(command) } };
  } catch { return denied(); }
}

// Reconstruct the closed command at the DO boundary, keeping correlation separate
// from the existing immutable reviewer request hash.
export async function validateBridgeCorrelation(bridge, authorization, env) {
  const config = configuration(env);
  if (!config) return denied('REVIEW_BRIDGE_DISABLED_OR_UNCONFIGURED');
  if (!CLOSED(bridge, BRIDGE_KEYS) || bridge.version !== 'genesis.review-bridge.v1'
    || !ASCII(bridge.commandHash) || !HASH.test(bridge.commandHash)) return denied();
  const command = { version: 'genesis.review-command.v1', action: 'request_review', commandId: bridge.commandId,
    deliveryId: bridge.deliveryId, ...Object.fromEntries(CONFIG_KEYS.map((key) => [key, bridge[key]])),
    ...Object.fromEntries(['repository', 'prNumber', 'expectedHeadSha', 'grantId', 'manifestHash', 'issuanceDigest'].map((key) => [key, authorization?.[key]])) };
  if (!validCommand(command, authorization, config) || await digest(canonical(command)) !== bridge.commandHash) return denied();
  return { ok: true, value: { bridge, command } };
}
