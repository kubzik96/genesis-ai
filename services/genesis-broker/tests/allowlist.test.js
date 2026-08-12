import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRoute, isAllowedGrokFile } from '../src/allowlist.js';

describe('allowlist', () => {
  it('allows known routes', () => {
    assert.equal(isAllowedRoute('GET', '/v1/health'), true);
    assert.equal(isAllowedRoute('POST', '/v1/executions/grok/draft-pr'), true);
  });

  it('rejects unknown routes', () => {
    assert.equal(isAllowedRoute('POST', '/v1/merge'), false);
    assert.equal(isAllowedRoute('DELETE', '/v1/issues/1'), false);
  });

  it('isAllowedGrokFile only MEMORY.md', () => {
    assert.equal(isAllowedGrokFile('MEMORY.md'), true);
    assert.equal(isAllowedGrokFile('./MEMORY.md'), true);
    assert.equal(isAllowedGrokFile('README.md'), false);
    assert.equal(isAllowedGrokFile('src/index.js'), false);
  });
});
