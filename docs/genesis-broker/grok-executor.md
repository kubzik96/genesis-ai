# Limited Grok Executor (S-0005 / T-011 Stage 1)

## Status

**CODE_AND_TESTS_ONLY** — Stage 1 EA.

- Production source + local unit/contract/negative/mock tests
- **No** live xAI calls, live GitHub writes, deployment, or secrets
- **No** merge, force-push, or non-draft PRs

## Endpoint

`POST /v1/executions/grok/draft-pr`

Operation: `create_branch_commit_draft_pr`

Composite fail-closed flow:
1. Validate gate + auth + rate limits + run bounds
2. Call xAI (mocked in tests) with closed JSON contract
3. Validate model response (schema + hard limits)
4. Dual base-SHA checks
5. Create branch → blob → tree → commit → draft PR
6. Audit + idempotency store

## Hard limits (enforced)

- Exactly 1 file: `MEMORY.md` only
- ≤ 3 lines changed
- ≤ 2 KiB unified diff
- UTF-8 only
- Draft PR only (never mergeable/ready)
- No secrets in response or audit payload

## Idempotency

`requestHash` + Durable Object `executeWrite` — safe replay.

## Tests

```bash
cd services/genesis-broker
node --test tests/grok-draft-pr.test.js
```

33 cases: happy path, auth/gate, idempotency, base-SHA mismatch, model validation, hard limits, partial failure (UNKNOWN), rate limit, no-merge.
