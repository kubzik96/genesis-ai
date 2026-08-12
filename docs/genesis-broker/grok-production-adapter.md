# Grok production adapter contract (S-0005 Revision 2)

## Authorization boundary

CEO granted Stage 2 `PRODUCTION_ADAPTER_CODE_AND_TESTS_ONLY` on 2026-08-12 for T-011. This permits source, local tests, documentation, the default-off Wrangler declaration, a feature branch, commits, and a Draft PR.

It does **not** permit deployment, Cloudflare changes, secret operations, Dify changes, live xAI calls, live GitHub runtime writes, smoke, Ready, or merge.

## xAI request

| Field | Reviewed value |
|---|---|
| Endpoint | `POST https://api.x.ai/v1/chat/completions` |
| Model | exact `grok-4.3`; aliases/fallback forbidden |
| Reasoning | `low` |
| Output | closed `json_schema`, `strict=true`, server revalidation retained |
| Streaming | `false` |
| Tools | absent |
| Calls/retries | one call; zero automatic retries |
| Output ceiling | 8,192 tokens |
| Source ceiling | 6 KiB UTF-8 and 4,096 lines |
| Serialized request | 32 KiB UTF-8 |
| Timeout | 45 seconds end-to-end |

High-confidence credential forms are rejected before the xAI network boundary. The same check is applied to model output before any GitHub write; matched values are never included in errors or logs.

Chat Completions is currently documented by xAI as legacy. This implementation must not auto-migrate. Endpoint retirement or incompatibility leaves the executor disabled until a new reviewed specification change.

## Activation: all conditions required

The endpoint returns `503 EXECUTOR_DISABLED` before xAI/GitHub calls unless all conditions match:

1. `GROK_EXECUTOR_LIVE_ENABLED` is exactly `true` under a later authorization;
2. Cloudflare `CF_VERSION_METADATA` is present, has a valid immutable version ID, and its version tag is the exact reviewed 40-character Git SHA listed in `GROK_EXECUTOR_REVIEWED_SHAS`;
3. `GROK_EXECUTOR_MODEL=grok-4.3`;
4. `GROK_EXECUTOR_SCHEMA_SHA256=7d491c8bc6cced3742e1b04567cc158bbff8b771db4de44ae96e014f7c3758be`;
5. `GROK_EXECUTOR_CONFIG_SHA256=613ad98634fae6824e135bf0fa845d60ab62e87191887bfe908d6a3bc5bb30da`;
6. `XAI_API_KEY`, `GITHUB_PAT`, and `BROKER_SERVICE_TOKEN` are present only as Worker Secrets;
7. the fixed Durable Object storage and budget ledger are available and not reconciliation-blocked.

The checked-in Wrangler value is `GROK_EXECUTOR_LIVE_ENABLED=false`. Wrangler declares the non-secret `CF_VERSION_METADATA` binding so the running version ID/tag, rather than a caller-supplied SHA string, is checked. A later separately authorized upload must use `wrangler versions upload --tag <exact-reviewed-git-sha>`; this PR does not upload or deploy anything.

## Budget ledger

- UTC calendar month;
- hard monthly ceiling: 50,000,000,000 ticks (USD 5.00);
- atomic pre-call reservation: 1,000,000,000 ticks (USD 0.10);
- authoritative settlement: `usage.cost_in_usd_ticks` from the one REST response;
- missing, negative, non-integer, or over-reservation cost blocks the live path before GitHub write;
- missing/invalid cost keeps the full reservation charged;
- over-reservation cost records the actual amount and blocks reconciliation;
- an in-flight reconciliation marker is persisted atomically with the reservation before xAI and is cleared only by a valid settlement or a proven pre-call release, so runtime termination cannot silently reopen the live path;
- reconciliation block is stored under the non-monthly `budget:xai:reconciliation` key and survives UTC month rollover until a separately authorized reconciliation clears it;
- malformed persisted monthly or reconciliation state fails closed and cannot normalize to zero spend;
- a failure before the network call releases the reservation;
- a crash after reservation can safely leave the full reservation charged.

Reasoning charges are not deducted or handled separately: the provider's total integer cost is authoritative.

## GitHub boundary

The client is fixed to `kubzik96/genesis-ai` and exposes only the methods needed by existing Broker operations plus the composite draft-PR path. It exposes no merge, delete-ref, force-push, workflow, secret, environment, or generic request method.

Future fine-grained credential permissions for this path:

- Metadata: read (implicit);
- Contents: read/write;
- Pull requests: read/write;
- no organization-wide access.

## Rollback / fail-closed response

Set or retain `GROK_EXECUTOR_LIVE_ENABLED=false`. Do not delete refs, branches, commits, or PRs automatically. If cost or a post-branch write is indeterminate, preserve the ledger/idempotency block and reconcile with read-only GitHub/provider evidence under a separate decision.
