# Deployment preflight (requires separate authorization)

**Not performed by S-0005 Stage 2 `CODE_AND_TESTS_ONLY`.** These are future Gate instructions, not permission to deploy or change configuration.

1. Create Cloudflare account / Workers project.
2. Bind Durable Object class `BrokerDurableObject` as `BROKER_DO`.
3. Deploy **exact** reviewed commit SHA.
4. Keep `GROK_EXECUTOR_LIVE_ENABLED=false`; do not add reviewed SHA/model/schema/config activation bindings during the deployment-only gate.
5. Set secrets only under a separate secret-operation authorization — never via Git.
6. Verify GET /v1/health and exact deployed SHA read-only.
7. Verify the executor returns `503 EXECUTOR_DISABLED` without making xAI/GitHub calls.

Future activation requires all pins in `grok-production-adapter.md`, a reconciled budget ledger, and a separate CEO gate. Deployment does not authorize live xAI or GitHub writes.
