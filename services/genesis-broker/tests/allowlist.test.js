import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedContextPath, matchRoute, assertRepoIsFixed } from '../src/allowlist.js';

describe('allowlist', () => {
  it('allows listed context paths', () => {
    assert.equal(isAllowedContextPath('bridge/QUEUE.md'), true);
    assert.equal(isAllowedContextPath('specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md'), true);
  });

  it('rejects unknown paths', () => {
    assert.equal(isAllowedContextPath('.env'), false);
    assert.equal(isAllowedContextPath('secrets/pat.txt'), false);
    assert.equal(isAllowedContextPath('../etc/passwd'), false);
  });

  it('matches only allowlisted routes', () => {
    assert.equal(matchRoute('GET', '/v1/health'), true);
    assert.equal(matchRoute('POST', '/v1/issues'), true);
    assert.equal(matchRoute('POST', '/v1/issues/12/assign-copilot'), true);
    assert.equal(matchRoute('POST', '/v1/merge'), false);
    assert.equal(matchRoute('DELETE', '/v1/issues/1'), false);
    assert.equal(matchRoute('POST', '/v1/proxy'), false);
  });

  it('rejects other repositories', () => {
    const r = assertRepoIsFixed('other', 'repo');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
});
