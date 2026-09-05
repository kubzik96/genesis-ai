# S-0010 — Genesis Independent Reviewer Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0010 |
| Title | Genesis Independent Reviewer Orchestration v0.1 |
| Status | **Approved** |
| Revision | 1 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-05 |
| Approval date | 2026-09-05 |
| Approved by | CEO Genesis AI |
| Related Issue | #89 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1 |
| Related Decisions | DR-0010; DR-0011; DR-0008 remains authoritative where applicable |
| Execution Authorization | **NOT_GRANTED** |

## 1. Purpose

Define the smallest safe orchestration layer around the already-proven S-0009 independent Grok/xAI reviewer contract so that, after an explicit bounded CEO review authorization, Genesis can invoke the reviewer, validate the result, durably persist exact-HEAD evidence in GitHub, and return to the next required CEO gate without requiring the CEO to run local PowerShell commands.

Target flow:

```text
Draft PR / review target
→ explicit bounded CEO review authorization
→ Genesis verifies exact PR HEAD
→ Genesis prepares bounded secret-free review request
→ exactly one Grok/xAI reviewer call
→ Genesis validates closed-schema output
→ Genesis re-verifies acceptance-time HEAD
→ trusted Genesis side persists normalized evidence to GitHub
→ Genesis presents the next applicable CEO gate
```

This specification orchestrates S-0009; it does not replace or broaden the reviewer contract.

## 2. Canonical boundaries

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. `MEMORY.md` remains a recovery index, not a second Source of Truth.

S-0009 Revision 1 and DR-0011 remain authoritative for reviewer identity, exact-HEAD binding, output invariants, actor independence, zero GitHub mutation authority for Grok/xAI, and fail-closed review semantics.

S-0010 MUST NOT give Grok/xAI GitHub PATs, repository write credentials, Broker service tokens, or any capability to mutate GitHub. Durable persistence is performed only by the trusted Genesis side after validation and acceptance-time exact-HEAD verification.

The token-economy routing preference is advisory: Grok/xAI is preferred for consequential independent review, architecture, security, disputed decisions, and important gate evidence; routine read-only checks, minor housekeeping, and ordinary diagnostics SHOULD avoid unnecessary xAI spend. This routing rule does not create standing LIVE/model-call authority.

## 3. Authorization envelope

A reviewer operation MUST begin from a bounded authorization that identifies at minimum:

- repository and PR number;
- exact expected 40-character PR HEAD SHA, or an instruction to resolve and bind the exact current HEAD before invocation;
- review purpose and applicable acceptance criteria;
- permission for one reviewer model request only;
- explicit prohibition or permission boundaries for durable evidence persistence;
- the consequential actions that remain forbidden after review unless separately authorized.

If authorization is missing, stale, ambiguous, or does not cover a model-generation call, Genesis MUST NOT invoke xAI and MUST fail closed.

A successful review never chains authority for Ready, merge, remediation, deploy, secrets, Dify, Broker, Cloudflare, quarantine removal, or another model call.

## 4. Review invocation contract

Genesis MUST reuse the existing S-0009 reviewer transport and validation contract unless a later separately approved specification authorizes a material change.

For each authorized review operation:

1. Verify repository identity and exact PR HEAD.
2. Collect only bounded changed-file metadata, unified diff, canonical task/specification context, and explicit review criteria required for the decision.
3. Exclude secrets, tokens, authorization headers, unrelated repository context, private payloads, and raw sensitive logs.
4. Invoke `grok-4.3` through the approved reviewer transport with exactly one request, retries `0`, streaming disabled, tools disabled, and configured byte/time/output bounds.
5. Validate the response against the S-0009 closed schema and cross-field invariants.
6. Re-fetch the current PR HEAD after review and require equality with the expected and reviewed SHA values.
7. Normalize any transport, schema, identity, scope, authorization, or HEAD ambiguity to a non-gate-safe blocked result.

No automatic second request is permitted. A new request after failure or a changed HEAD requires a new applicable authorization.

## 5. Trusted durable-persistence contract

A validated review intended to influence a consequential gate MUST be durably persisted in GitHub before Genesis treats it as gate evidence.

The trusted persistence record MUST include at minimum:

- reviewer identity: Genesis Independent Grok Reviewer / Grok-xAI;
- exact reviewed HEAD SHA;
- normalized verdict;
- head-confirmation state;
- scope state;
- normalized findings or explicit `none`;
- ready-gate-safety state;
- a statement that the record is evidence only and does not grant subsequent authority.

Immediately before persistence, Genesis MUST complete the acceptance-time exact-HEAD check. If the HEAD changed, the result is stale and MUST NOT be persisted as positive gate evidence.

Persistence MUST occur through a trusted Genesis GitHub write boundary. Grok/xAI itself receives no write capability.

## 6. One-window orchestration requirement

The target product behavior is that the CEO does not need to copy commands, run local scripts, move review output manually, or re-enter the same bounded context after granting a valid review authorization.

After authorization, Genesis SHOULD autonomously complete all non-consequential orchestration steps that are already allowed by the authorization and supported by available tools:

- exact-HEAD read verification;
- bounded review-request preparation;
- single reviewer invocation;
- output validation;
- acceptance-time HEAD verification;
- trusted durable persistence when authorized;
- read-only verification that the persisted evidence is attached to the same exact HEAD;
- presentation of the next mandatory CEO gate.

Local PowerShell remains an emergency/fallback path only. It is not the intended production reviewer experience.

## 7. Fail-closed requirements

Genesis MUST stop without positive gate evidence when any of the following occurs:

1. reviewer-call authorization is absent or ambiguous;
2. repository, PR, or exact HEAD cannot be verified;
3. expected, reviewed, and acceptance-time HEAD values do not all match;
4. bounded diff/context is unavailable, unsafe, or exceeds the reviewer contract;
5. model invocation would expose a secret or repository write credential;
6. the xAI request fails, times out, or returns malformed/contradictory output;
7. the S-0009 verdict/finding invariants fail;
8. Grok/xAI would be the sole independent reviewer of Grok-produced work;
9. trusted durable persistence is unavailable for a verdict intended to influence a consequential gate;
10. a requested action would silently expand into Ready, merge, remediation, deployment, secrets, Dify, Broker, Cloudflare, quarantine removal, or another control plane.

Fail-closed behavior MUST NOT automatically retry the xAI request.

## 8. Actor independence

The actor-independence requirement from S-0009 remains unchanged. Grok/xAI MUST NOT be the sole independent reviewer of any artifact materially produced by Grok/xAI.

When Grok/xAI produced the reviewed artifact, Genesis MUST route independent review to a different qualified reviewer or stop and surface the missing independent-review dependency.

Qodo may remain optional fallback/scaffolding while available, but S-0010 MUST NOT depend on Qodo as the permanent reviewer path.

## 9. Security and authority boundaries

S-0010 does not authorize:

- any GitHub credential or write authority for Grok/xAI;
- standing xAI LIVE authority;
- automatic repeated model calls;
- automatic Ready or merge;
- automatic remediation or branch mutation based on findings;
- deployment or Cloudflare changes;
- Dify execution or configuration changes;
- authenticated Broker runtime use;
- secrets creation, inspection, transfer, rotation, or replacement;
- DR-0008 quarantine removal;
- modification of the S-0005 writer authority;
- a new control plane or trust boundary.

If implementation requires a new trust boundary, new control plane, Grok GitHub credentials, expanded Broker authority, or a material departure from S-0009/DR-0011, implementation MUST stop and a new or revised Decision Record is required before proceeding.

## 10. Implementation boundary after Approval

After Specification Approval, a separate Execution Authorization MUST name an exact file allowlist and executor.

The minimum implementation SHOULD be orchestration glue around existing proven reviewer modules and trusted GitHub read/write capabilities. It SHOULD NOT rewrite the S-0009 reviewer transport merely to automate invocation.

An implementation MAY provide a product-native or service-side trigger that consumes a bounded review authorization and performs the flow in Sections 3–6, but the trigger MUST preserve default-off/no-standing-authority semantics.

No deployment or first production-runtime activation is part of ordinary code implementation unless separately authorized.

## 11. Verification requirements

Before an implementation may be considered review-ready, local/mock or otherwise non-consequential verification MUST demonstrate at minimum:

- no authorization => zero xAI requests;
- valid authorization => at most one reviewer request;
- retries remain `0`;
- exact-HEAD mismatch before invocation blocks the call;
- changed HEAD after review invalidates the result;
- malformed/contradictory output fails closed;
- secret-like input/output is rejected under the existing reviewer contract;
- inability to durably persist consequential evidence prevents gate-safe completion;
- durable evidence is bound to the reviewed exact HEAD;
- Grok/xAI has no GitHub mutation capability;
- Grok self-review is rejected as sole independent review evidence;
- no automatic Ready, merge, remediation, deploy, Dify, Broker, Cloudflare, secrets, or quarantine action occurs;
- the CEO can complete an authorized review flow without running a local command when the target runtime path is available.

Any real LIVE reviewer invocation remains separately gated unless a future CEO-approved governance change explicitly creates a narrower standing authorization model.

## 12. Acceptance criteria

S-0010 v0.1 is approval-ready only when the specification makes all of the following explicit:

- S-0009/DR-0011 remain the reviewer contract and trust boundary;
- each reviewer model call requires applicable bounded authority; token-economy routing alone is not authority;
- one reviewer request maximum and retries `0`;
- request-time, reviewed, and acceptance-time HEAD are bound;
- bounded secret-free context is enforced;
- model output is untrusted until validated;
- consequential review evidence is durably persisted by trusted Genesis before use;
- Grok/xAI receives zero GitHub write credentials and zero mutation authority;
- actor independence is preserved;
- failure of invocation, validation, HEAD checks, or persistence fails closed;
- the target experience removes CEO local-command/manual evidence-transfer steps after a valid review gate;
- Ready, merge, implementation EA, deploy, secrets, Dify, Broker, Cloudflare, future LIVE/model calls where separately gated, and quarantine removal remain distinct gates.

## 13. Non-goals

This Approved Specification does not implement orchestration, authorize code changes, invoke xAI, deploy anything, change secrets, change Cloudflare, resume Dify/Broker runtime, remove quarantine, merge a PR, or approve itself.

It does not attempt to solve the separate Codex initial-PR publication limitation.

## 14. Gates and next step

Current state: **Approved Revision 1 / Execution Authorization NOT_GRANTED**.

The CEO approved S-0010 Revision 1 on 2026-09-05 against independently reviewed PR #91 HEAD `aa53292d3c7e8063a3da58bbebf7c05dd6f760ca`.

Next step: after this controlled status promotion is verified, obtain a separate CEO Ready authorization for PR #91 if the promoted exact HEAD remains consistent. Merge remains a later separate CEO gate. Only after S-0010 is durable on `main` may a separately bounded implementation Execution Authorization be considered.

No Specification Approval or successful review implicitly grants Ready, merge, implementation EA, deploy, LIVE/model calls, Dify, Broker, Cloudflare, secrets changes, or quarantine removal.