# Idempotency (Durable Object)

Authoritative store: **SQLite-backed Durable Object** (not KV).

## Rules

1. New key → atomic PENDING → then GitHub.
2. Same key + same hash → replay, no second GitHub call.
3. Same key + different hash → 409 IDEMPOTENCY_CONFLICT.
4. Concurrent writes serialized by one DO.
5. Timeout / indeterminate → UNKNOWN → BLOCKED_RECONCILIATION_REQUIRED (no auto-retry).

## Rate limits

- Max 10 writes/hour per service token.
- Per run_id: one successful create Issue + one successful assign.
- Assign only Issue created by Broker in that run_id.
