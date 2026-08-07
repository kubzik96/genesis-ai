# Idempotency (Durable Object)

Authoritative store: **SQLite-backed Durable Object** (not KV).

## Rules

1. New key → atomic PENDING → then GitHub.
2. Same key + same hash → replay, no second GitHub call.
3. Same key + different hash → 409 IDEMPOTENCY_CONFLICT.
4. Concurrent writes serialized by one DO.
5. Timeout / indeterminate → UNKNOWN → BLOCKED_RECONCILIATION_REQUIRED (no auto-retry).

## Canonical request_hash identity (S-0002 §4.5)

`request_hash` covers **GitHub side-effect identity only**:

- create_issue: `{ op, title, body, labels, run_id, gate }` after normalization
  (title trim non-empty; body string or ""; labels trimmed, de-duplicated, sorted)
- assign_copilot: `{ op, issue_number, run_id, gate }`

**`confirmed_at` is NOT part of request_hash.** It is Gate freshness metadata,
validated on every request before store access. A client retry with the same
Idempotency-Key, same side-effect payload, and a new valid `confirmed_at` must
REPLAY — not CONFLICT.

## Rate limits

- Max 10 writes/hour per service token.
- Per run_id: one successful create Issue + one successful assign.
- Assign only Issue created by Broker in that run_id.

## Stale PENDING after crash (fail-closed)

If the Durable Object writes `PENDING` and then crashes (or is evicted) before
finalizing SUCCEEDED / FAILED / UNKNOWN:

- Reconstruction finds `PENDING` and returns **409 IDEMPOTENCY_IN_FLIGHT**.
- Another write for that key is **not** permitted.
- **No automatic TTL** transitions PENDING → UNKNOWN or retries the write in MVP.
- **No silent** PENDING → UNKNOWN conversion.

**Ops procedure (manual):**

1. Read-only reconciliation first (e.g. GET `/v1/issues/{n}/status` or GitHub UI)
   to observe whether the upstream write already happened.
2. Do **not** auto-retry the write.
3. Any reconciliation endpoint or authoritative state mutation requires a
   **separate design and CEO authorization** — not part of Stage 1 CODE_ONLY.
