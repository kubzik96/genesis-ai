# Deployment preflight (requires separate authorization)

**Not performed by S-0005 Stage 2 `CODE_AND_TESTS_ONLY`.** These are future Gate instructions, not permission to deploy or change configuration.

1. Create Cloudflare account / Workers project.
2. Bind Durable Object class `BrokerDurableObject` as `BROKER_DO`.
3. Upload the **exact** reviewed commit as a Cloudflare version with `wrangler versions upload --tag <exact-reviewed-git-sha>`; confirm the returned immutable version ID and tag read-only.
4. Deploy only that version, with `GROK_EXECUTOR_LIVE_ENABLED=false`; do not add the reviewed SHA/model/schema/config activation bindings during the deployment-only gate.
5. Set secrets only under a separate secret-operation authorization — never via Git.
6. Verify GET /v1/health and exact deployed SHA read-only.
7. Verify the executor returns `503 EXECUTOR_DISABLED` without making xAI/GitHub calls.

Future activation requires all pins in `grok-production-adapter.md`, a reconciled budget ledger, and a separate CEO gate. Deployment does not authorize live xAI or GitHub writes.
