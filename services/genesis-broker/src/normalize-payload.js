/**
 * Canonical create_issue payload normalization (S-0002 §4.5).
 *
 * Idempotency identity for create_issue is the hash of:
 *   { op, title, body, labels, run_id, gate }
 * after this normalization — NOT confirmed_at (Gate freshness only).
 * The same normalized values MUST be used for requestHash, operationData, and GitHub call.
 */

/**
 * @param {{ title?: unknown, body?: unknown, labels?: unknown }} input
 * @returns {{ ok: true, title: string, body: string, labels: string[] } | { ok: false, status: number, error: string, message: string }}
 */
export function normalizeCreateIssuePayload(input) {
  const { title, body, labels } = input || {};

  if (typeof title !== 'string') {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_TITLE',
      message: 'title must be a non-empty string',
    };
  }
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_TITLE',
      message: 'title must be a non-empty string',
    };
  }

  let normalizedBody = '';
  if (body === undefined || body === null) {
    normalizedBody = '';
  } else if (typeof body !== 'string') {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_BODY',
      message: 'body must be a string',
    };
  } else {
    normalizedBody = body;
  }

  let normalizedLabels = [];
  if (labels === undefined || labels === null) {
    normalizedLabels = [];
  } else if (!Array.isArray(labels)) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_LABELS',
      message: 'labels must be an array of non-empty strings',
    };
  } else {
    const seen = new Set();
    for (const item of labels) {
      if (typeof item !== 'string') {
        return {
          ok: false,
          status: 400,
          error: 'INVALID_LABELS',
          message: 'labels must be an array of non-empty strings',
        };
      }
      const trimmed = item.trim();
      if (!trimmed) {
        return {
          ok: false,
          status: 400,
          error: 'INVALID_LABELS',
          message: 'labels must not contain empty strings after trim',
        };
      }
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        normalizedLabels.push(trimmed);
      }
    }
    normalizedLabels.sort();
  }

  return {
    ok: true,
    title: normalizedTitle,
    body: normalizedBody,
    labels: normalizedLabels,
  };
}
