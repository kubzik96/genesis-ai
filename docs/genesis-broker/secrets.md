# Secrets handling

## Required secrets (Worker Secrets only)

| Name | Purpose |
|---|---|
| `GITHUB_PAT` | Fine-grained user PAT, repo-only kubzik96/genesis-ai |
| `BROKER_SERVICE_TOKEN` | Shared secret for Dify → Broker Bearer auth |
| `XAI_API_KEY` | xAI model call from the default-off S-0005 production adapter |

## Storage boundaries

- `GITHUB_PAT` and `XAI_API_KEY` exist only as Worker Secrets and are never stored in Dify.
- `BROKER_SERVICE_TOKEN` exists as a Worker Secret. Dify may reference the same value only through a separately authorized secret variable used for Broker authentication.
- Secret values must never appear in visible Dify node fields, prompts, request/response bodies, execution details, audit logs, Git, Issue or PR content.
- Never return secrets from API responses.
- Short expiry (7–30 days) is required for spike credentials.

## Exposure classification

Treat any secret value displayed in UI, execution details, logs, screenshots, prompts or exported workflow data as potentially compromised, even when external disclosure is not proven.

For a potentially exposed credential:

1. do not reproduce or copy its value into chat, Git, Issue, PR or evidence;
2. preserve only redacted evidence until retention is decided;
3. stop every operation that uses the credential;
4. record the quarantine decision in GitHub;
5. rotate the affected credential before its next authenticated use under a separate CEO authorization;
6. do not rotate unrelated secrets without evidence or a separate lifecycle reason.

`GROK_EXECUTOR_LIVE_ENABLED=false` protects only the Grok production adapter. It does not disable other Broker endpoints authenticated by `BROKER_SERVICE_TOKEN`.

## Active quarantine

DR-0008 applies to the potentially exposed `BROKER_SERVICE_TOKEN`:

- any authenticated Broker read or write call is prohibited before rotation;
- Dify node-runs, full workflow and publish using Broker authentication are prohibited;
- activation and live xAI/GitHub calls remain prohibited;
- local tests, documentation, architecture and read-only GitHub review remain allowed;
- quarantine is lifted only by a separate CEO decision after rotation and controlled verification.

No evidence currently marks `XAI_API_KEY` or `GITHUB_PAT` as compromised. The GitHub PAT expiry on 2026-09-07 is a separate calendar gate.

S-0005 Stage 2 `CODE_AND_TESTS_ONLY`: **do not create, read, move, rotate, or configure secrets**. Secret placement or rotation is a later separately authorized operation.
