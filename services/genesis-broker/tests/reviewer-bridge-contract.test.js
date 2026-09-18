import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseStrictJsonBytes, validateBridgeAdmission, validateBridgeCorrelation } from '../src/reviewer-bridge.js';

const encode = (value) => new TextEncoder().encode(value);
const canonical = (value) => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])));
const config = { producerAppId: 123, installationId: 456, eventName: 'approved_event', eventAction: 'approved_action' };
const env = { GITHUB_REVIEW_BRIDGE_ENABLED: 'true', GITHUB_REVIEW_BRIDGE_CONFIG: JSON.stringify(config) };
const authorization = { repository: 'kubzik96/genesis-ai', prNumber: 92, expectedHeadSha: 'a'.repeat(40), grantId: 'github:issue-comment:9001', manifestHash: '1'.repeat(64), issuanceDigest: '2'.repeat(64) };
const command = (overrides = {}) => ({ version: 'genesis.review-command.v1', action: 'request_review', commandId: 'github-review-command:123', deliveryId: '00000000-0000-4000-8000-000000000000', ...config, ...authorization, ...overrides });
const body = (overrides = {}) => ({ command: canonical(command()), authorization: { ...authorization }, context: 'Bounded mock review', run_id: 'bridge-test', ...overrides });
const blocked = (result) => { assert.equal(result.ok, false); assert.equal(result.body.ready_gate_safe, 'NO'); assert.equal(result.body.consequential_gate_evidence_available, false); };

describe('strict raw JSON scanner', () => {
  it('preserves valid JSON primitives, arrays, strings and nested data', () => {
    for (const data of [null, true, false, 1, -1.25e4, 'quotes" slash\\ unicodeя', [], {}, { authorization: { values: [1, 'x'] }, context: '{}' }]) {
      assert.deepEqual(parseStrictJsonBytes(encode(JSON.stringify(data))), data);
    }
  });
  it('rejects duplicates before object construction, including escaped and nested keys', () => {
    for (const raw of ['{"authorization":{},"authorization":{}}', '{"bridge":1,"bridge":2}', '{"run_id":1,"run_id":2}', '{"context":1,"context":2}', '{"bridge":1,"br\\u0069dge":2}', '{"authorization":{"grantId":1,"grantId":2}}', '{"x":[{"a":1,"a":2}]}', '{"__proto__":1,"__proto__":2}']) {
      assert.throws(() => parseStrictJsonBytes(encode(raw)), /Invalid JSON bytes/);
    }
  });
  it('rejects malformed UTF8, BOM, malformed grammar, trailing tokens and excessive depth', () => {
    for (const bytes of [new Uint8Array([0xc0, 0xaf]), new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), ...['', '{', '{"a":}', '[1,]', '{"a":1,}', 'true false', '01', 'NaN', '"bad\nstring"', '"\\x20"', '"\\u12"', '['.repeat(66) + '0' + ']'.repeat(66)].map(encode)]) {
      assert.throws(() => parseStrictJsonBytes(bytes), /Invalid JSON bytes/);
    }
  });
});

describe('closed canonical bridge command', () => {
  it('binds canonical bytes to SHA256 and independently revalidates DO correlation', async () => {
    const result = await validateBridgeAdmission(body(), env);
    assert.equal(result.ok, true);
    const expected = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encode(body().command))), (n) => n.toString(16).padStart(2, '0')).join('');
    assert.equal(result.value.bridge.commandHash, expected);
    assert.equal((await validateBridgeCorrelation(result.value.bridge, authorization, env)).ok, true);
    assert.deepEqual(Object.keys(result.value.bridge).sort(), ['version', 'commandId', 'commandHash', 'deliveryId', 'producerAppId', 'installationId', 'eventName', 'eventAction'].sort());
  });
  it('rejects missing, extra, wrong-type, null and nested members in every command field', async () => {
    for (const key of Object.keys(command())) {
      const missing = command(); delete missing[key];
      blocked(await validateBridgeAdmission(body({ command: canonical(missing) }), env));
      for (const bad of [null, {}, [], true]) blocked(await validateBridgeAdmission(body({ command: canonical(command({ [key]: bad })) }), env));
    }
    blocked(await validateBridgeAdmission(body({ command: canonical(command({ extra: 1 })) }), env));
    blocked(await validateBridgeAdmission(body({ command: canonical(command({ commandId: 'caller-generated' })) }), env));
    for (const key of Object.keys(body())) {
      const missing = body(); delete missing[key];
      blocked(await validateBridgeAdmission(missing, env));
    }
    blocked(await validateBridgeAdmission(body({ extra: true }), env));
    blocked(await validateBridgeAdmission(body({ bridge: {} }), env));
    blocked(await validateBridgeAdmission(body({ command: command() }), env));
  });
  it('rejects noncanonical whitespace, order, escapes, integers and duplicate command keys', async () => {
    for (const raw of [JSON.stringify(command()), ' ' + canonical(command()), canonical(command()) + '\n', canonical(command()).replace('"prNumber":92', '"prNumber":92.0'), canonical(command()).replace('"prNumber":92', '"prNumber":9.2e1'), canonical(command()).replace('request_review', 'request_\\u0072eview'), canonical(command()).replace('"action":', '"action":"request_review","action":'), '\ufeff' + canonical(command())]) {
      blocked(await validateBridgeAdmission(body({ command: raw }), env));
    }
  });
  it('rejects mismatched repo, producer, installation, event/action and grant tuple', async () => {
    for (const [key, value] of Object.entries({ repository: 'wrong/repo', producerAppId: 124, installationId: 457, eventName: 'issue_comment', eventAction: 'created', prNumber: 93, expectedHeadSha: 'b'.repeat(40), grantId: 'github:issue-comment:9002', manifestHash: '3'.repeat(64), issuanceDigest: '4'.repeat(64) })) {
      blocked(await validateBridgeAdmission(body({ command: canonical(command({ [key]: value })) }), env));
    }
    for (const [key, value] of Object.entries({ commandId: 'github-review-command:123\n', deliveryId: '00000000-0000-0000-0000-000000000000', prNumber: Number.MAX_SAFE_INTEGER + 1, expectedHeadSha: 'A'.repeat(40), grantId: 'arbitrary', manifestHash: 'A'.repeat(64) })) {
      blocked(await validateBridgeAdmission(body({ command: canonical(command({ [key]: value })) }), env));
    }
  });
  it('requires explicit gate and complete unambiguous trusted configuration', async () => {
    for (const testEnv of [{}, { ...env, GITHUB_REVIEW_BRIDGE_ENABLED: false }, { ...env, GITHUB_REVIEW_BRIDGE_ENABLED: true }, { ...env, GITHUB_REVIEW_BRIDGE_CONFIG: undefined }, ...['{}', 'null', '{"producerAppId":123,"producerAppId":456}', JSON.stringify({ ...config, extra: true }), JSON.stringify({ ...config, installationId: null })].map((raw) => ({ ...env, GITHUB_REVIEW_BRIDGE_CONFIG: raw }))]) {
      blocked(await validateBridgeAdmission(body(), testEnv));
    }
  });
  it('rejects altered bridge correlation and authorization during DO revalidation', async () => {
    const { value } = await validateBridgeAdmission(body(), env);
    for (const bridge of [{ ...value.bridge, extra: true }, { ...value.bridge, commandHash: 'f'.repeat(64) }, { ...value.bridge, deliveryId: '00000000-0000-4000-8000-000000000001' }, { ...value.bridge, producerAppId: 999 }]) {
      blocked(await validateBridgeCorrelation(bridge, authorization, env));
    }
    blocked(await validateBridgeCorrelation(value.bridge, { ...authorization, manifestHash: '3'.repeat(64) }, env));
    blocked(await validateBridgeCorrelation(value.bridge, authorization, {}));
  });
});
