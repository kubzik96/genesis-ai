# Broker-side reviewer bridge admission (S-0010 Revision 3)

This is code-only admission, not a deployed GitHub webhook receiver or production proof.

## Entries and trust boundary

- `POST /v1/reviews/grok` remains Direct mode with exactly `authorization`, `context`, `run_id`.
- `POST /v1/reviews/grok/bridge` is the separate authenticated Bridge admission entry. It accepts exactly `command`, `authorization`, `context`, `run_id`. The mode is selected by the entry, not an optional JSON member.
- Both entries require existing Broker service authentication. The Controller must not receive that credential. Only a separately authorized trusted adapter may submit the Bridge admission payload in production.
- The new entry validates and builds `genesis.review-bridge.v1`, then invokes the same existing reviewer execution function, DO instance and evidence writer as Direct. It contains no xAI transport.
- `command` is a string containing the exact canonical UTF-8 JSON representation of `genesis.review-command.v1`. This preserves raw command representation across the outer payload; the validated command must reserialize byte-for-byte identically. Do not parse/reconstruct a noncanonical upstream command before submission.
- The outer body is bounded by the existing reviewer request byte limit. Invalid UTF-8, BOM, malformed JSON and duplicate keys (including escaped aliases, at all object depths) are rejected before constructing objects. The command and configuration have closed schemas.

## Configuration — absent means OFF

`GITHUB_REVIEW_BRIDGE_ENABLED` must be the literal string `true`. No configuration is installed by this PR.

`GITHUB_REVIEW_BRIDGE_CONFIG` must be a JSON string with exactly four keys:

```json
{"producerAppId":123,"installationId":456,"eventName":"repository_dispatch","eventAction":"review_command"}
```

These are offline examples, not approved production identities. App/installation are positive safe integers. Event/action are pinned literals matching S-0010. Missing/malformed configuration fails closed. Caller fields must exactly match it.

`XAI_REVIEWER_LIVE_ENABLED` is independent and must also equal `true` for Bridge execution, including test injection. Bridge OFF blocks before any DO mutation. No Wrangler/secrets/permissions/LIVE state is changed by this implementation.

## Scope of authentication

Service authentication proves a Broker client, not a GitHub webhook signature. This entry does not accept webhook headers or pretend to validate a GitHub delivery signature. A future separately authorized external adapter must authenticate original raw webhook bytes and the pinned GitHub producer before submitting this closed command. Adding webhook/authenticity fields to this body is rejected, not treated as evidence. No webhook secret is assumed to exist.

Removing command metadata from a request to the Bridge entry fails closed; it never falls back to Direct. Moving a request to another endpoint is a new authenticated Direct operation, subject to existing canonical grant constraints. Previously bound bridge idempotency records cannot be replayed or resumed as Direct; fresh attempts share the same one-consumption grant ledger.

## Durable identities and recovery

The existing reviewer `request_hash` derivation is unchanged: the Worker hashes its existing `review_grok` operation/run/authorization/context payload. Bridge correlation never enters that derivation.

A transaction atomically reserves the existing grant and links command ID, command hash, delivery ID, grant/digests, repository, PR, expected HEAD and run/request/idempotency identities. Command/delivery indices reference the authoritative grant consumption record and idempotency outcome; they are not independent reusable budgets. A separate transaction persists CONSUMED before the existing model client is invoked.

Changed command/delivery/grant combinations cannot produce another dispatch. Interrupted Bridge PENDING/UNKNOWN attempts permit read-only reconciliation only. They are not automatically resumed, released, retried, migrated or assigned another grant. Same-HEAD terminal replay remains model-free; positive replay also requires complete stored correlation and F1 current-HEAD verification.

The existing `GENESIS_REVIEW_EVIDENCE_V2` GitHub envelope gains `bridge`, `issuanceDigest` and `expected_head_sha` only for Bridge executions. Read-back must match the complete serialized record, including these fields. Normalized result semantics, existing persistence failures and UNKNOWN behavior remain in the existing reviewer path.

## Validation limits

Tests use local transactional storage fakes, fake GitHub and fake provider fetch. They prove dispatch counts and fault handling under those deterministic models. They do not prove Cloudflare deployment, real Durable Object infrastructure, upstream webhook authenticity, installed App identity, or production end-to-end execution. Those remain separately gated.
