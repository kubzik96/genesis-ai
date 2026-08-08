# Secrets handling

## Required secrets (Worker Secrets only)

| Name | Purpose |
|---|---|
| `GITHUB_PAT` | Fine-grained user PAT, repo-only kubzik96/genesis-ai |
| `BROKER_SERVICE_TOKEN` | Shared secret for Dify → Broker Bearer auth |

## Rules

- Never commit secret values.
- Never put PAT in Dify, LLM prompts, Issue/PR bodies, or audit logs.
- Never return secrets from API responses.
- Short expiry (7–30 days) for spike.

CODE_ONLY stage: **do not create** these secrets yet.
