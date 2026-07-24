import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../src/audit.js';

describe('audit redact', () => {
  it('redacts token-like fields', () => {
    const out = redact({
      Authorization: 'Bearer abc',
      GITHUB_PAT: 'ghp_xxx',
      path: 'bridge/QUEUE.md',
      nested: { secret: 'x', ok: 1 },
    });
    assert.equal(out.Authorization, '[REDACTED]');
    assert.equal(out.GITHUB_PAT, '[REDACTED]');
    assert.equal(out.nested.secret, '[REDACTED]');
    assert.equal(out.nested.ok, 1);
    assert.equal(out.path, 'bridge/QUEUE.md');
  });
});
