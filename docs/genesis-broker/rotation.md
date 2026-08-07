# Secret rotation

1. Create new fine-grained PAT (repo-only, short expiry).
2. wrangler secret put GITHUB_PAT with the new value.
3. Revoke old PAT in GitHub UI immediately.
4. Rotate BROKER_SERVICE_TOKEN the same way.
5. Confirm /v1/health and a read-only context call.
