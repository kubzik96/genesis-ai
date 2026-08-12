# Limited Grok Executor (S-0005 / T-011 Stage 1)

## Status

**CODE_AND_TESTS_ONLY** — Stage 1 EA.

- Production source + local unit/contract/negative/mock tests
- **No** live xAI calls
- **No** live GitHub writes from this path in Stage 1 runtime
- **No** deployment, secrets operations, Dify changes, or smoke

## Endpoint

```text
POST /v1/executions/grok/draft-pr
operation = create_branch_commit_draft_pr
```

### Required headers

- `Authorization: Bearer <BROKER_SERVICE_TOKEN>`
- `Idempotency-Key: <unique key>`

### Body (minimal)

```json
{
  "run_id": "unique-run-id",
  "gate": "G2",
  "confirmed_at": "ISO-8601",
  "base_sha": "40-char commit SHA",
  "task": {
    "title": "bounded task",
    "instruction": "exact requested change",
    "allowed_files": ["MEMORY.md"]
  }
}
```

Repository, base branch, branch prefix and hard limits are fixed by the Broker.

## Sequence (fail-closed)

1. Service auth, Gate TTL (G2), rate limit, idempotency
2. Resolve actual `main` SHA; mismatch → `409 BASE_SHA_MISMATCH`
3. Load allowlisted context (`MEMORY.md`)
4. Call xAI via closed contract
5. Validate JSON schema + hard limits
6. Re-check `main` SHA
7. blob → tree → commit → branch `genesis/grok/<run-id>` → **draft** PR
8. Persist safe idempotency result
9. Return PR artifacts
10. Status `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW`

## Hard limits (Revision 1)

| Limit | Value |
|---|---|
| Repository | `kubzik96/genesis-ai` only |
| Base branch | `main` only |
| Branch | new `genesis/grok/<run-id>` only |
| Files | max 1; `MEMORY.md` only |
| Changed lines | ≤ 3 |
| Unified diff | ≤ 2 KiB |
| Content | UTF-8 text only |
| Commits / PRs | 1 commit, 1 **draft** PR |
| Writes per run | max 1 successful composite |
| Merge / force-push / generic proxy | **absent** |

## Idempotency & partial failure

- Same key + same request → replay
- Same key + different request → `409 IDEMPOTENCY_CONFLICT`
- Indeterminate failure after write → `UNKNOWN` + `BLOCKED_RECONCILIATION_REQUIRED`
- Auto-retry after UNKNOWN forbidden

## Secrets

- Grok never receives GitHub credentials or service tokens
- `XAI_API_KEY` binding is a later-stage secret operation
- No secrets in response, audit logs, or fixtures

## Tests

```bash
cd services/genesis-broker
node --test tests/**/*.test.js
```
