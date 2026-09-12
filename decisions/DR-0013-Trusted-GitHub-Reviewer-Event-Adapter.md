# DR-0013 — Trusted GitHub Reviewer Event Adapter

## Status

**Proposed / In Review**

## Date

2026-09-12

## Context

Genesis already has a bounded independent Grok/xAI reviewer path and an existing authenticated execution boundary at `POST /v1/reviews/grok`. S-0010 Revision 2 defines canonical CEO reviewer grants, exact-HEAD binding, one-consumption semantics, durable evidence, and fail-closed behavior.

Issue #128 established the remaining One-Window transport gap: the ChatGPT/Genesis controller can read and write GitHub but does not possess `BROKER_SERVICE_TOKEN` or `XAI_API_KEY` and cannot safely invoke the authenticated reviewer endpoint directly. Treating ordinary GitHub issues/comments as executable reviewer commands is unsafe because general repository write authority is not equivalent to reviewer-execution authority and could race or prematurely consume a one-shot grant.

Codex design work in Issue #129 independently reached the same boundary and proposed a dedicated GitHub App plus external webhook adapter as the minimum safe bridge.

This Decision Record proposes that architecture only. It grants no implementation or runtime authority.

## Decision

Use a dedicated, independently administered **GitHub App producer + trusted external webhook adapter** in front of the existing Genesis reviewer runtime.

Target flow:

```text
CEO issues bounded canonical reviewer grant in GitHub
→ trusted GitHub App emits one closed-schema reviewer command/event
→ external adapter verifies GitHub authenticity and pinned producer identity
→ adapter validates immutable command identity and canonical grant binding
→ existing authenticated reviewer runtime / Durable Object atomically admits the command
→ existing POST /v1/reviews/grok path performs at most one Grok/xAI request
→ terminal result/evidence is durably persisted and read back in GitHub
→ Genesis continues only from verified durable evidence
```

The bridge is transport and admission only. It MUST NOT mint reviewer authority.

## Trust root

An executable reviewer command is trusted only when all of the following are verified:

1. repository is exactly `kubzik96/genesis-ai`;
2. event originates from the dedicated approved GitHub App installation/producer identity, not an arbitrary repository writer;
3. event/action type is the closed reviewer-command action;
4. GitHub delivery/event authenticity is cryptographically verified by the adapter;
5. command identity is immutable and unique;
6. target PR and exact expected HEAD are explicit;
7. command binds to an already-issued canonical CEO reviewer grant using `grantId`, `manifestHash`, and issuance/provenance digest;
8. the canonical grant is valid, unused, exact-HEAD compatible, and permits one reviewer model request;
9. bridge and reviewer runtime gates are both explicitly enabled for the bounded operation.

Ordinary issue comments, PR comments, labels, branch pushes, repository write access, agent output, review approval, or successful tests MUST NOT by themselves become executable reviewer authority.

## Command contract

The accepted implementation design MUST use a closed, versioned, secret-free command schema containing at minimum:

- schema/version;
- immutable command ID;
- GitHub delivery/event identity;
- repository identity;
- PR number;
- exact expected HEAD SHA;
- `grantId`;
- `manifestHash`;
- canonical issuance/provenance digest or immutable receipt reference;
- review purpose and bounded criteria reference;
- creation timestamp/sequence evidence sufficient for replay handling.

The command contains no Broker token, xAI credential, GitHub write credential, or other secret.

## Credential placement

- One-Window controller: **no Broker or xAI secrets**.
- Dedicated GitHub App: only permissions required to produce/identify the bounded command event; no model credential.
- External adapter: isolates webhook verification material, least-privilege GitHub read capability needed for verification, and the credential required to reach the existing authenticated Broker reviewer boundary.
- Existing reviewer runtime: retains the xAI credential and existing reviewer validation logic.
- Grok/xAI: receives no GitHub mutation credential and no Broker credential.

No secret value may be persisted in GitHub evidence.

## Atomic admission and replay safety

The existing authoritative Durable Object / reviewer runtime remains responsible for one-consumption semantics.

Before model dispatch, admission MUST atomically bind:

- command identity;
- GitHub delivery identity;
- canonical `grantId` + `manifestHash`;
- repository/PR/exact HEAD;
- technical operation/request identity.

A duplicate, replay, concurrent race, changed command, stale HEAD, already-reserved/consumed/closed grant, or ambiguous state MUST produce zero additional model dispatches.

`UNKNOWN` is non-reusable. Uncertain dispatch/evidence/finalization state permits read-only reconciliation only; it MUST NOT auto-release authority or trigger another model request.

## Default-OFF requirements

The bridge requires an independent explicit default-OFF control in addition to the existing reviewer production/LIVE control.

Bridge OFF => zero Broker reviewer dispatch.

Reviewer OFF => zero xAI/Grok dispatch even if a valid bridge command exists.

A future bounded activation must require both controls plus a valid canonical grant and all runtime preconditions.

## Existing execution boundary

The existing reviewer runtime and authenticated `POST /v1/reviews/grok` contract remain the sole reviewer execution boundary. This DR does not create a public unauthenticated model endpoint and does not authorize bypassing Broker authentication, reviewer authorization, exact-HEAD checks, budgets, idempotency, or durable evidence rules.

## Durable evidence

A consequential reviewer result is usable only after trusted persistence and read-back in GitHub against the same exact HEAD, command identity, and reviewer grant.

Evidence MUST distinguish at minimum success, blocked/rejected, failed, and `UNKNOWN` outcomes. A transport success without verified durable evidence is not gate-safe.

## Fail-closed conditions

Zero model dispatch is required for at least:

- untrusted or forged producer identity;
- invalid GitHub event authentication;
- wrong repository/installation/action/delivery binding;
- malformed or ambiguous command;
- stale/mismatched PR HEAD;
- absent, stale, malformed, mismatched, consumed, closed, or unknown grant;
- duplicate/replayed command or delivery;
- bridge OFF;
- reviewer runtime OFF;
- missing runtime prerequisite/secret binding;
- atomic admission failure;
- uncertain prior dispatch state;
- inability to durably persist/reconcile required evidence.

## Rejected alternatives

### Ordinary GitHub comment/issue as executable command

Rejected. Repository write authority is too broad and does not prove reviewer-execution authority. It can race or prematurely consume a one-shot grant.

### Give the One-Window controller Broker/xAI secrets

Rejected. It expands the controller credential surface and defeats the intended separation of control, transport, and model credentials.

### Public unauthenticated Worker endpoint

Rejected. It bypasses the existing Broker authentication boundary and creates a model-call abuse surface.

### No external trust component

Rejected for the current architecture. A safe GitHub-native bridge still needs a component that verifies the trusted producer/event and reaches the authenticated reviewer boundary without exposing Broker/xAI secrets to the controller.

## Verification required before implementation acceptance

A future default-OFF implementation MUST prove with tests at minimum:

- bridge OFF => zero reviewer/model dispatch;
- reviewer OFF => zero model dispatch;
- forged/untrusted producer => zero dispatch;
- malformed command => zero dispatch;
- stale HEAD => zero dispatch;
- missing/invalid grant => zero dispatch;
- duplicate/replay/race => total model dispatch ≤ 1;
- crash/uncertain admission => no automatic second request;
- controller requires no Broker/xAI secrets;
- Grok receives no GitHub mutation capability;
- durable terminal evidence binds command, grant, PR and exact HEAD;
- existing S-0009/S-0010 reviewer suites remain green.

## Governance boundary

This DR is **Proposed**. It does not alter the CEO-approved status of S-0010 Revision 2 and does not itself grant S-0010 Revision 3 approval.

Acceptance of this DR alone grants **no** implementation, GitHub App creation/installation, webhook deployment, secret/PAT operation, authenticated Broker call, xAI/Grok call, Cloudflare deployment/traffic change, LIVE/bridge enablement, Dify action, Ready, merge, DR-0008 security-boundary lift, or standing model-call authority.

Implementation requires a separate bounded Execution Authorization after independent exact-HEAD review and any required S-0010 normative revision is independently reviewed and CEO-approved.