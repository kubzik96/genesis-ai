# Secret rotation

Every secret rotation requires a separate, exact-scope CEO authorization. Do not include secret values in chat, commands stored in history, Git, Issue, PR, screenshots or logs.

## General rules

1. Rotate only the affected credential unless evidence or a lifecycle deadline requires more.
2. Generate and enter values locally; never expose them to an LLM.
3. Keep production fail-closed during the whole operation.
4. Update all authorized consumers before the first new authenticated call.
5. Do not use a successful secret update as implicit permission to deploy, run Dify, activate or call live APIs.
6. Ambiguous state means STOP and read-only reconciliation; never repeat a write command blindly.

## BROKER_SERVICE_TOKEN incident rotation

For DR-0008 Quarantine Option B:

1. Preserve only redacted incident evidence; do not delete Dify run history until retention is decided.
2. Confirm `GROK_EXECUTOR_LIVE_ENABLED=false` and maintain the ban on all authenticated Broker calls.
3. Generate a new high-entropy raw service token locally.
4. Under an authorized Cloudflare secret operation, create the exact Worker version with the new raw token stored as `BROKER_SERVICE_TOKEN`; do not create unrelated versions or change other secrets.
5. Update only Dify secret variable `BROKER_AUTHORIZATION` with the full header value `Bearer <same new raw token>`. Do not place either the raw token or the full header value in visible node fields.
6. Under a separate promotion authorization, deploy only the verified secret-complete Worker version. During the Worker/Dify transition, run nothing.
7. Verify deployment ID, bindings and `GROK_EXECUTOR_LIVE_ENABLED=false` read-only. Secret values must not be read back or displayed.
8. Perform at most one controlled authenticated check only after a separate CEO authorization, using a non-Dify client that does not persist or display the Authorization header. A failed or ambiguous result is STOP, not permission to retry.
9. Do not perform an authentication check with the old token. Promotion of the version containing the replacement Worker Secret is the invalidation mechanism.
10. Keep every authenticated Dify run prohibited until a separately authorized remediation and verification plan proves safe logging without sending the new credential through the current HTTP node. Do not use a Dify node-run to test whether masking works.
11. Lift quarantine only by a separate CEO decision.

Replacing the Worker Secret invalidates the old service token only after the new secret-complete version is promoted to traffic.

## GITHUB_PAT lifecycle rotation

This is separate from DR-0008 unless evidence changes:

1. Create a new fine-grained PAT with repository access only to `kubzik96/genesis-ai`, minimum required permissions and short expiry.
2. Store it only as the Worker `GITHUB_PAT` Secret under separate authorization.
3. Promote only the verified secret-complete version under separate authorization.
4. Revoke the old PAT in GitHub immediately after successful promotion and read-only verification.
5. Do not run live GitHub writes as part of rotation verification.

The current PAT expiry on 2026-09-07 requires its own calendar gate.

## XAI_API_KEY rotation

Rotate `XAI_API_KEY` only on evidence of exposure, provider lifecycle need or separate CEO decision. Rotation does not authorize `GROK_EXECUTOR_LIVE_ENABLED=true` or an xAI call.
