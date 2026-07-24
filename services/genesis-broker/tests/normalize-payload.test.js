import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCreateIssuePayload } from '../src/normalize-payload.js';

describe('normalizeCreateIssuePayload', () => {
  it('trims title and rejects empty title', () => {
    const ok = normalizeCreateIssuePayload({ title: '  Hello  ', body: 'x' });
    assert.equal(ok.ok, true);
    assert.equal(ok.title, 'Hello');

    const empty = normalizeCreateIssuePayload({ title: '   ' });
    assert.equal(empty.ok, false);
    assert.equal(empty.error, 'INVALID_TITLE');
    assert.equal(empty.status, 400);

    const notStr = normalizeCreateIssuePayload({ title: 1 });
    assert.equal(notStr.ok, false);
    assert.equal(notStr.error, 'INVALID_TITLE');
  });

  it('normalizes body null/omitted to empty string; rejects non-string body', () => {
    assert.equal(normalizeCreateIssuePayload({ title: 't' }).body, '');
    assert.equal(normalizeCreateIssuePayload({ title: 't', body: null }).body, '');
    assert.equal(normalizeCreateIssuePayload({ title: 't', body: 'hi' }).body, 'hi');

    const bad = normalizeCreateIssuePayload({ title: 't', body: 42 });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, 'INVALID_BODY');
  });

  it('normalizes labels: trim, dedupe, sort; rejects invalid', () => {
    const a = normalizeCreateIssuePayload({
      title: 't',
      labels: [' bug ', 'enhancement', 'bug'],
    });
    assert.equal(a.ok, true);
    assert.deepEqual(a.labels, ['bug', 'enhancement']);

    const b = normalizeCreateIssuePayload({
      title: 't',
      labels: ['enhancement', 'bug'],
    });
    assert.deepEqual(b.labels, ['bug', 'enhancement']);

    assert.deepEqual(normalizeCreateIssuePayload({ title: 't' }).labels, []);
    assert.deepEqual(normalizeCreateIssuePayload({ title: 't', labels: null }).labels, []);

    const notArr = normalizeCreateIssuePayload({ title: 't', labels: 'bug' });
    assert.equal(notArr.ok, false);
    assert.equal(notArr.error, 'INVALID_LABELS');

    const emptyItem = normalizeCreateIssuePayload({ title: 't', labels: ['  '] });
    assert.equal(emptyItem.ok, false);
    assert.equal(emptyItem.error, 'INVALID_LABELS');

    const nonStr = normalizeCreateIssuePayload({ title: 't', labels: [1] });
    assert.equal(nonStr.ok, false);
    assert.equal(nonStr.error, 'INVALID_LABELS');
  });
});
