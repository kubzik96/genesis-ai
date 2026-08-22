# DR-0009 — Private Dify Genesis Broker Tool Plugin

## Status

**Принято**

## Date

2026-08-23

## Context

DR-0008 recorded that a raw Dify HTTP node displayed the Broker Authorization header in execution details. The replacement `BROKER_SERVICE_TOKEN` was stored in Dify, promoted in Worker version `d7536ffd-22a0-4593-abc8-37b13cfcee4e` at 100% traffic, and verified read-only with `GROK_EXECUTOR_LIVE_ENABLED=false`. Quarantine remains active because the separately authorized controlled authenticated check was not performed and safe Dify logging has not been independently confirmed.

The One-Window spike still needs a Dify-to-Broker client boundary. Continuing with raw HTTP nodes would repeat the exposure class. A private Dify Tool Plugin can keep the provider credential out of workflow parameters and construct the header inside runtime code.

## Decision

Adopt a private, typed Tool Plugin as the Dify-to-Broker integration path for the approved CODE_ONLY scope. Start with a read-only `context_read` slice and these invariants:

1. Broker credential is provider-level `secret-input` only.
2. The provider stores the raw 64-character token; the plugin creates `Bearer <raw>` internally.
3. Credential validation is local-only and performs no request.
4. The Broker origin and operation routes are fixed in code; no generic proxy exists.
5. Authorization, credentials, request headers, and raw transport exceptions are never logged or returned.
6. Response sanitization removes credential-bearing fields and exact credential occurrences.
7. Write tools require a later approved scope, independent review, and separate CEO gates.
8. Plugin install/upload, credential entry, Dify run/publish, Broker calls, secrets operations, deployment, and activation are not authorized by this decision.

## Alternatives

- Keep raw HTTP nodes: rejected because the known execution-details exposure class remains.
- Put `Bearer <raw>` in a workflow variable: rejected because the workflow layer continues to own the sensitive header.
- Add a generic Broker HTTP tool: rejected because it weakens route and origin allowlists.

## Consequences

Positive: smaller secret surface, typed operations, locally testable policy, fixed destination, and a migration path away from header-bearing workflow nodes.

Negative: a private plugin must later be packaged, installed, reviewed for Dify runtime behavior, and maintained against Dify SDK changes. Local tests cannot prove how a future Dify version renders internal plugin execution details.

## Approval boundary

CEO approved DR-0009 and S-0006 Revision 1 on 2026-08-23 for the existing CODE_ONLY scope. This approval accepts the architecture and reviewed code candidate only; it does not authorize Ready, merge, plugin packaging/upload/install, credential entry, Dify changes/run/publish, Broker HTTP, Cloudflare or secret operations, deployment, activation, or live GitHub/xAI runtime calls. Each later action remains behind its separate repository and CEO gate.

## Related records

- `specifications/S-0001-Genesis-One-Window-Execution-Spike.md`
- `specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md`
- `decisions/DR-0008-Broker-Token-Exposure-Quarantine.md`
- `docs/genesis-broker/dify-private-tool-plugin.md`
