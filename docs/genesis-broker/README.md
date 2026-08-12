# Genesis Secure GitHub Broker (S-0002)

Security boundary between Dify and GitHub for Path **B2** (Copilot Pro Issue Assignment API).

## Stage

**CODE_ONLY** (T-010 Stage 1) + **Limited Grok Executor** (T-011 Stage 1, CODE_AND_TESTS_ONLY)

- Source + unit/mocked/negative tests in Git
- **No** Cloudflare deployment
- **No** PAT / secrets created
- **No** live GitHub write operations (tests use mocks)

## Layout

```text
services/genesis-broker/
  src/           Worker + DO + pure logic
  tests/         node:test suite
  wrangler.toml  deploy config without secrets
docs/genesis-broker/
  deployment.md secrets.md rotation.md revoke.md teardown.md
  grok-executor.md
```

## Run tests

```bash
cd services/genesis-broker
npm test
# or: node --test tests/**/*.test.js
node --test tests/grok-draft-pr.test.js
```

## Endpoints (allowlist only)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/health` | fail-closed without PAT/DO |
| POST | `/v1/context/read` | allowlisted paths only |
| POST | `/v1/issues` | G1 + Idempotency-Key |
| POST | `/v1/issues/{n}/assign-copilot` | G2; issue must belong to same run_id |
| GET | `/v1/issues/{n}/status` | read-only |
| GET | `/v1/pulls/{n}` | metadata + CI hint |
| GET | `/v1/pulls/{n}/diff` | files + unified diff |
| POST | `/v1/executions/grok/draft-pr` | G_GROK_DRAFT_PR; limited MEMORY.md draft PR (T-011) |

**Absent:** merge, push, delete, generic proxy, other repos.

## Authoritative store

SQLite-backed **Durable Object** (not Workers KV).

## Fixed

- Repository: `kubzik96/genesis-ai`
- Base branch: `main`

## Limited Grok Executor (S-0005)

See [grok-executor.md](./grok-executor.md) for T-011 Stage 1 endpoint, hard limits, and contract.
