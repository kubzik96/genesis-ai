# Deployment (after separate authorization)

**Not performed in CODE_ONLY stage.**

1. Create Cloudflare account / Workers project.
2. Bind Durable Object class `BrokerDurableObject` as `BROKER_DO`.
3. Deploy **exact** reviewed commit SHA.
4. Set secrets via wrangler secret put — never via Git.
5. Verify GET /v1/health returns ok only when PAT + DO present.
6. Read-only smoke: POST /v1/context/read for allowlisted path.

Live writes remain forbidden until S-0001 encoding scenario authorization.
