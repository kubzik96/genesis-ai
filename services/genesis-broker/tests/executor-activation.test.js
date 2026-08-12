import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExecutorActivation } from '../src/executor-activation.js';
import {
  GROK_EXECUTOR_CONFIG_SHA256,
  XAI_MODEL,
  XAI_RESPONSE_SCHEMA_SHA256,
} from '../src/xai-contract.js';

const SHA = 'a'.repeat(40);
const VERSION_ID = '123e4567-e89b-42d3-a456-426614174000';

function activeEnv(overrides = {}) {
  return {
    GROK_EXECUTOR_LIVE_ENABLED: 'true',
    XAI_API_KEY: 'xai-test',
    GITHUB_PAT: 'github-test',
    BROKER_SERVICE_TOKEN: 'broker-test',
    BROKER_DO: {},
    GROK_EXECUTOR_REVIEWED_SHAS: SHA,
    CF_VERSION_METADATA: {
      id: VERSION_ID,
      tag: SHA,
      timestamp: '2026-08-12T18:00:00.000Z',
    },
    GROK_EXECUTOR_MODEL: XAI_MODEL,
    GROK_EXECUTOR_SCHEMA_SHA256: XAI_RESPONSE_SCHEMA_SHA256,
    GROK_EXECUTOR_CONFIG_SHA256,
    ...overrides,
  };
}

describe('executor activation', () => {
  it('is default-off and returns one safe public error', () => {
    const result = evaluateExecutorActivation(activeEnv({ GROK_EXECUTOR_LIVE_ENABLED: 'false' }), {
      requireDoBinding: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'EXECUTOR_DISABLED');
    assert.equal(result.reason, 'FLAG_OFF');
    assert.doesNotMatch(result.message, /XAI_API_KEY|GITHUB_PAT|BROKER_SERVICE_TOKEN/);
  });

  it('requires the deployed SHA in the reviewed set and exact contract pins', () => {
    assert.equal(evaluateExecutorActivation(activeEnv(), { requireDoBinding: true }).ok, true);
    assert.equal(evaluateExecutorActivation(activeEnv({ GROK_EXECUTOR_REVIEWED_SHAS: 'b'.repeat(40) }), { requireDoBinding: true }).reason, 'DEPLOYED_SHA_NOT_REVIEWED');
    assert.equal(evaluateExecutorActivation(activeEnv({ GROK_EXECUTOR_MODEL: 'grok-latest' }), { requireDoBinding: true }).reason, 'MODEL_MISMATCH');
    assert.equal(evaluateExecutorActivation(activeEnv({ GROK_EXECUTOR_SCHEMA_SHA256: 'bad' }), { requireDoBinding: true }).reason, 'SCHEMA_MISMATCH');
    assert.equal(evaluateExecutorActivation(activeEnv({ GROK_EXECUTOR_CONFIG_SHA256: 'bad' }), { requireDoBinding: true }).reason, 'CONFIG_MISMATCH');
  });

  it('uses the immutable runtime version tag instead of a mutable claimed deployed SHA', () => {
    const result = evaluateExecutorActivation(activeEnv({
      GENESIS_DEPLOYED_SHA: SHA,
      CF_VERSION_METADATA: {
        id: VERSION_ID,
        tag: 'b'.repeat(40),
        timestamp: '2026-08-12T18:00:00.000Z',
      },
    }), { requireDoBinding: true });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'DEPLOYED_SHA_NOT_REVIEWED');
  });

  it('requires valid Cloudflare runtime version metadata', () => {
    assert.equal(evaluateExecutorActivation(activeEnv({ CF_VERSION_METADATA: null }), { requireDoBinding: true }).reason, 'VERSION_METADATA_MISSING');
    assert.equal(evaluateExecutorActivation(activeEnv({
      CF_VERSION_METADATA: { id: 'not-a-version-id', tag: SHA, timestamp: '2026-08-12T18:00:00.000Z' },
    }), { requireDoBinding: true }).reason, 'VERSION_METADATA_INVALID');
  });

  it('requires the Durable Object binding at the worker boundary and storage in the DO', () => {
    assert.equal(evaluateExecutorActivation(activeEnv({ BROKER_DO: null }), { requireDoBinding: true }).reason, 'DURABLE_OBJECT_MISSING');
    assert.equal(evaluateExecutorActivation(activeEnv(), { storageAvailable: false }).reason, 'BUDGET_LEDGER_MISSING');
    assert.equal(evaluateExecutorActivation(activeEnv(), { storageAvailable: true }).ok, true);
  });
});
