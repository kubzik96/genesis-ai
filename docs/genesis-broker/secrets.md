# Secrets handling

## Required secrets (Worker Secrets only)

| Name | Purpose |
|---|---|
| `GITHUB_PAT` | Fine-grained user PAT, repo-only kubzik96/genesis-ai |
| `BROKER_SERVICE_TOKEN` | Shared secret for Dify → Broker Bearer auth |
| `XAI_API_KEY` | xAI model call from the default-off S-0005 production adapter |

## Rules

- Never commit secret values.
- Never put PAT, xAI key, or service token in Dify, LLM prompts, Issue/PR bodies, or audit logs.
- Never return secrets from API responses.
- Short expiry (7–30 days) for spike.

S-0005 Stage 2 `CODE_AND_TESTS_ONLY`: **do not create, read, move, rotate, or configure secrets**. Secret placement is a later separately authorized operation.
