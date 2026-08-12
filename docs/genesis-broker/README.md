# Genesis Secure GitHub Broker (S-0002)

Security boundary between Dify and GitHub for Path **B2** (Copilot Pro Issue Assignment API).

## Current stage

**S-0005 Revision 2 — Stage 2 `PRODUCTION_ADAPTER_CODE_AND_TESTS_ONLY`** (T-011)

- Production-capable xAI/GitHub adapter code, but default-off
- Local unit/contract/negative/recovery tests use deterministic fixtures and injected fetch boundaries
- This stage performs **no** deployment, secret operation, Dify change, live xAI/GitHub call, or smoke
- `GROK_EXECUTOR_LIVE_ENABLED` remains `false` in `wrangler.toml`

## Layout

```text
services/genesis-broker/
  src/           Worker + DO + pure logic
  tests/         node:test suite
  wrangler.toml  deploy config without secrets
docs/genesis-broker/
  deployment.md grok-production-adapter.md secrets.md rotation.md revoke.md teardown.md
```

## Run tests

```bash
cd services/genesis-broker
npm test
# or: node --test tests/**/*.test.js
```

## Endpoints (allowlist only)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/health` | fail-closed without PAT/DO |
| POST | `/v1/context/read` | allowlisted paths only |
| POST | `/v1/issues` | G1 + Idempotency-Key |
| POST | `/v1/issues/{n}/assign-copilot` | G2; issue must belong to same run_id |
| POST | `/v1/executions/grok/draft-pr` | `operation=create_branch_commit_draft_pr`, S-0005 hard limits, default-off production adapter |
| GET | `/v1/issues/{n}/status` | read-only |
| GET | `/v1/pulls/{n}` | metadata + CI hint |
| GET | `/v1/pulls/{n}/diff` | files + unified diff |

**Absent:** merge, push, delete, generic proxy, other repos.

`/v1/executions/grok/draft-pr` supports Stage 1 test adapters and the Stage 2 production adapter. The production path activates only when every reviewed SHA/model/schema/config/secret/DO condition matches. Otherwise it returns `503 EXECUTOR_DISABLED` before xAI or GitHub calls.

The production contract and future activation preflight are documented in [grok-production-adapter.md](grok-production-adapter.md).

Unified diff hard-limit enforcement (`<= 2048` UTF-8 bytes) is fail-closed before any write path and includes a per-hunk 81-byte Git-visible hunk-header section allowance (80-byte section text cap + 1 separator byte).

## Authoritative store

SQLite-backed **Durable Object** (not Workers KV).

## Fixed

- Repository: `kubzik96/genesis-ai`
- Base branch: `main`
