# S-0010 — Genesis Independent Reviewer Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0010 |
| Title | Genesis Independent Reviewer Orchestration v0.1 |
| Status | **Approved** |
| Revision | 2 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-05 |
| Approval date | 2026-09-10 |
| Approved by | CEO Genesis AI |
| Related Issue | #89; #116 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1 |
| Related Decisions | DR-0010; DR-0011; DR-0008 remains authoritative where applicable |
| Execution Authorization | **NOT_GRANTED** |

## Revision history

| Revision | Date | Change |
|---|---|---|
| 1 | 2026-09-05 | Initial approved reviewer-orchestration contract. |
| 2 | 2026-09-10 | F2 authorization-consumption contract: canonical CEO EA → immutable `grantId` + `manifestHash` → durable one-consumption ledger; strict legacy/cutover and crash-reconciliation boundaries; exact future implementation allowlist and invariants. |

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

Revision 2 additionally closes the F2 authorization-consumption design gap proven in Issue #116 and tests-only Draft PR #117. It does not itself implement the fix or authorize runtime mutation.

## 2. Canonical boundaries

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. `MEMORY.md` remains a recovery index, not a second Source of Truth.

S-0009 Revision 1 and DR-0011 remain authoritative for reviewer identity, exact-HEAD binding, output invariants, actor independence, zero GitHub mutation authority for Grok/xAI, and fail-closed review semantics.

S-0010 MUST NOT give Grok/xAI GitHub PATs, repository write credentials, Broker service tokens, or any capability to mutate GitHub. Durable persistence is performed only by the trusted Genesis side after validation and acceptance-time exact-HEAD verification.

The token-economy routing preference is advisory: Grok/xAI is preferred for consequential independent review, architecture, security, disputed decisions, and important gate evidence; routine read-only checks, minor housekeeping, and ordinary diagnostics SHOULD avoid unnecessary xAI spend. This routing rule does not create standing LIVE/model-call authority.

DR-0008 remains fully authoritative. Nothing in Revision 2 lifts quarantine, authorizes an authenticated production Broker call, enables LIVE, deploys a Worker, mutates secrets, or authorizes D2.

## 3. Authorization envelope

A reviewer operation MUST begin from a bounded authorization that identifies at minimum:

- repository and PR number;
- exact expected 40-character PR HEAD SHA, or an instruction to resolve and bind the exact current HEAD before invocation;
- review purpose and applicable acceptance criteria;
- permission for one reviewer model request only;
- explicit prohibition or permission boundaries for durable evidence persistence;
- the consequential actions that remain forbidden after review unless separately authorized.

Revision 2 requires the accepted authorization to additionally carry a stable grant binding described in Section 3.1.

If authorization is missing, stale, ambiguous, or does not cover a model-generation call, Genesis MUST NOT invoke xAI and MUST fail closed.

A successful review never chains authority for Ready, merge, remediation, deploy, secrets, Dify, Broker, Cloudflare, quarantine removal, or another model call.

### 3.1 F2 grant identity contract

One CEO issuance MUST map to exactly one immutable reviewer grant identity.

The accepted design direction is:

```text
canonical GitHub CEO EA
→ immutable grantId
+ manifestHash of immutable authorization conditions
→ durable one-consumption ledger
```

Requirements:

1. `grantId` identifies the specific CEO-issued authorization. It MUST NOT be derived from `run_id`, Idempotency-Key, request hash, retry/session identity, reviewer result, or a caller-generated random value.
2. The trusted Genesis issuer boundary MUST materialize or recover the same `grantId` from canonical GitHub evidence for every use of the same issued authorization.
3. A legitimate new authorization with otherwise identical conditions MUST receive a new canonical issuance identity; equal payloads alone do not imply the same grant.
4. `manifestHash` binds the immutable conditions of that grant. It is a binding/integrity value, not the sole grant identity.
5. The manifest MUST bind at minimum repository, PR number, exact expected HEAD, purpose, ordered criteria, artifact producer, model-call permission and limit, durable-persistence permission, and forbidden actions.
6. Manifest canonicalization MUST be deterministic. Object keys are sorted; unordered sets such as forbidden actions are normalized as sorted sets; ordered arrays such as review criteria preserve order; UTF-8 bytes are hashed with SHA-256. No semantic rewriting of arbitrary text is permitted.
7. The canonical GitHub EA receipt/location and a digest sufficient to detect mutation of the issuance record MUST be recoverable by the trusted issuer. If provenance or digest cannot be verified, the grant is not usable.
8. A changed EA condition requires a new canonical CEO issuance and a new `grantId`; changing `run_id`, Idempotency-Key, request text formatting, or local session identity MUST NOT create new authority.
9. `grantId` is not a credential. It does not expand the trust boundary and does not replace service authentication.
10. Review approval, Qodo approval, agent output, successful tests, or a prior successful model result MUST NOT create or refresh a grant.

### 3.2 Grant consumption lifecycle

Consumption is bound to an admitted attempt, not only to a successful model result.

Before any model dispatch, the authoritative Durable Object transition MUST atomically reserve the grant together with the current technical execution identities needed to prevent races.

Minimum states/semantics:

- `RESERVED`: valid grant admitted and reserved before model dispatch; no second dispatch under this grant is permitted.
- `CONSUMED`: a model dispatch occurred, regardless of positive/negative review or provider/result outcome; no second dispatch is permitted.
- `CLOSED_NO_CALL`: an admitted attempt closed before model dispatch after a deterministic failure; this grant remains closed and cannot be silently reused.
- `UNKNOWN`: execution/evidence/finalization state is indeterminate; no second dispatch is permitted and only read-only reconciliation is allowed.

No implementation may introduce automatic `RELEASED`, TTL unlock, PENDING/UNKNOWN auto-clear, silent grant regeneration, or automatic second model request.

A fresh model request after failure, changed HEAD, closed grant, or unknown state requires a genuinely new applicable CEO authorization with a new canonical grant identity.

### 3.3 Legacy and cutover rules

Revision 2 MUST fail closed across legacy records:

- legacy records MUST NOT be assigned a new `grantId` retroactively and then treated as unused authority;
- before any future production activation, old SUCCEEDED/FAILED/PENDING/UNKNOWN reviewer records require a separately authorized read-only inventory/reconciliation step;
- a legacy request without `grantId` MUST NOT enter the fresh execution path;
- an exact same-key/request-hash historical SUCCEEDED record may only use the existing immutable replay path, still subject to F1 current-HEAD validation;
- legacy FAILED preserves its blocked/failed semantics;
- legacy PENDING/UNKNOWN/CONFLICT MUST NOT be promoted to success or converted into fresh authority;
- if the old exact record or its relationship to canonical authorization cannot be recovered, execution remains blocked;
- migration/cutover itself never creates a new CEO authorization.

Production inventory, migration and activation are outside ordinary F2 code implementation and require later operational gates.

## 4. Review invocation contract

Genesis MUST reuse the existing S-0009 reviewer transport and validation contract unless a later separately approved specification authorizes a material change.

For each authorized review operation:

1. Verify repository identity and exact PR HEAD.
2. Validate canonical `grantId`/`manifestHash` binding and ensure the grant is admissible before model dispatch.
3. Collect only bounded changed-file metadata, unified diff, canonical task/specification context, and explicit review criteria required for the decision.
4. Exclude secrets, tokens, authorization headers, unrelated repository context, private payloads, and raw sensitive logs.
5. Invoke `grok-4.3` through the approved reviewer transport with exactly one request, retries `0`, streaming disabled, tools disabled, and configured byte/time/output bounds.
6. Validate the response against the S-0009 closed schema and cross-field invariants.
7. Re-fetch the current PR HEAD after review and require equality with the expected and reviewed SHA values.
8. Normalize any transport, schema, identity, grant-consumption, scope, authorization, or HEAD ambiguity to a non-gate-safe blocked result.

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

Revision 2 requires the next evidence-envelope version used for F2-safe runtime to additionally bind enough immutable execution identity for deterministic reconciliation, at minimum:

- `grantId`;
- `manifestHash`;
- canonical request hash or equivalent immutable operation identity;
- `run_id` as execution correlation only, never authority;
- exact reviewed PR/HEAD;
- versioned evidence-envelope identifier;
- durable GitHub receipt/comment identifier after write/read-back.

Immediately before persistence, Genesis MUST complete the acceptance-time exact-HEAD check. If the HEAD changed, the result is stale and MUST NOT be persisted as positive gate evidence.

Persistence MUST occur through a trusted Genesis GitHub write boundary. Grok/xAI itself receives no write capability.

A GitHub evidence record and Durable Object execution ledger have distinct roles: GitHub remains canonical project evidence/SoT; the Durable Object is the authoritative execution-consumption ledger and MUST NOT become a competing project/governance SoT.

## 6. One-window orchestration requirement

The target product behavior is that the CEO does not need to copy commands, run local scripts, move review output manually, or re-enter the same bounded context after granting a valid review authorization.

After authorization, Genesis SHOULD autonomously complete all non-consequential orchestration steps that are already allowed by the authorization and supported by available tools:

- exact-HEAD read verification;
- canonical grant binding verification;
- bounded review-request preparation;
- single reviewer invocation;
- output validation;
- acceptance-time HEAD verification;
- trusted durable persistence when authorized;
- read-only verification that the persisted evidence is attached to the same exact HEAD and grant binding;
- presentation of the next mandatory CEO gate.

Local PowerShell remains an emergency/fallback path only. It is not the intended production reviewer experience.

## 7. Fail-closed requirements

Genesis MUST stop without positive gate evidence when any of the following occurs:

1. reviewer-call authorization is absent or ambiguous;
2. canonical `grantId`/`manifestHash` provenance is absent, malformed, mismatched, already consumed/closed, or unknown;
3. repository, PR, or exact HEAD cannot be verified;
4. expected, reviewed, and acceptance-time HEAD values do not all match;
5. bounded diff/context is unavailable, unsafe, or exceeds the reviewer contract;
6. model invocation would expose a secret or repository write credential;
7. the xAI request fails, times out, or returns malformed/contradictory output;
8. the S-0009 verdict/finding invariants fail;
9. Grok/xAI would be the sole independent reviewer of Grok-produced work;
10. trusted durable persistence is unavailable for a verdict intended to influence a consequential gate;
11. execution/evidence/finalization state is `RESERVED` or `UNKNOWN` and cannot be reconciled read-only;
12. a requested action would silently expand into Ready, merge, remediation, deployment, secrets, Dify, Broker, Cloudflare, quarantine removal, another model call, or another control plane.

Fail-closed behavior MUST NOT automatically retry the xAI request or release a grant for reuse.

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

Revision 2 approval does NOT grant implementation authority. A separate Execution Authorization MUST name exact base/HEAD preconditions, executor and exact file allowlist.

The accepted **maximum implementation allowlist for the bounded F2 code fix** is:

### Production/runtime source

- `services/genesis-broker/src/reviewer-orchestrator.js`
- `services/genesis-broker/src/reviewer-runtime.js`
- `services/genesis-broker/src/durable-object.js`

### Tests

- **creation or update explicitly permitted:** `services/genesis-broker/tests/reviewer-authorization-reproduction.test.js`. This path is currently published in tests-only Draft PR #117, not in `main`; a future F2 implementation may create it from the verified #117 characterization evidence and then replace/augment defect expectations with normative at-most-one invariants.
- `services/genesis-broker/tests/reviewer-orchestrator.test.js`
- `services/genesis-broker/tests/reviewer-runtime.test.js`
- `services/genesis-broker/tests/durable-object.test.js`

No other production/runtime/config/schema/documentation path is pre-authorized by this specification. In particular, `src/index.js`, `src/do-proxy-store.js`, `wrangler.toml`, migrations, Cloudflare configuration, secrets, Dify, S-0005 writer code and GitHub credential handling are OUTSIDE the implementation allowlist unless a later CEO gate explicitly expands it.

If implementation proves impossible within this allowlist, STOP and return the exact missing path/reason; do not silently expand scope.

The implementation SHOULD preserve the existing transport and request-hash path where possible: current `src/index.js` already hashes the normalized authorization object together with run/context, and current `src/do-proxy-store.js` forwards the authorization to the Durable Object. Revision 2 therefore does not assume either file must change.

No deployment or first production-runtime activation is part of F2 code implementation.

## 11. Verification requirements

Before a Revision 2 implementation may be considered review-ready, local/mock or otherwise non-consequential verification MUST demonstrate at minimum:

### Existing S-0010 invariants

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
- no automatic Ready, merge, remediation, deploy, Dify, Broker, Cloudflare, secrets, or quarantine action occurs.

### F2 invariants

1. Same canonical grant + same run + same idempotency identity: replay only; model dispatch total remains ≤1.
2. Same grant + new `run_id`: no new model dispatch.
3. Same grant + new Idempotency-Key: no new model dispatch.
4. Same grant + both new run/key: no new model dispatch.
5. Concurrent requests for the same grant across different run/key identities: exactly one admission/model dispatch maximum.
6. Durable Object reconstruction after reserve preserves the consumed/blocked grant and does not permit another model dispatch.
7. Crash after model dispatch but before final state cannot make the grant reusable.
8. Crash after evidence write/read-back ambiguity cannot make the grant reusable; state becomes/remains `UNKNOWN` until reconciliation.
9. A caller-supplied arbitrary new `grantId` without canonical issuer mapping is rejected before model dispatch.
10. Same authorization payload with a different legitimate canonical CEO issuance can use a different grant only when the issuer evidence proves that separate issuance.
11. `manifestHash` mismatch or mutated canonical EA receipt blocks before model dispatch.
12. Legacy request without `grantId` cannot fall through to fresh execution.
13. Historical same-key/hash SUCCEEDED replay remains model-free and still performs F1 current-HEAD verification.
14. Legacy PENDING/UNKNOWN/CONFLICT remains fail-closed and model-free.
15. Failed provider/malformed result after dispatch consumes/closes the grant; no auto-release/retry.
16. Evidence V2 binds `grantId`, `manifestHash`, request/operation identity and exact PR/HEAD sufficiently for later read-only reconciliation.
17. Existing F1 stale-positive replay protection remains green.
18. Full Broker suite remains green with no unauthorized network/production calls.

The tests-only evidence in PR #117 remains characterization evidence for the defect. A fix MUST replace/augment the known-defect two-dispatch expectations with the normative at-most-one-grant invariant rather than claiming those existing green tests prove remediation.

Any real LIVE reviewer invocation remains separately gated.

## 12. Acceptance criteria

S-0010 Revision 2 is accepted only with all of the following explicit:

- S-0009/DR-0011 remain the reviewer contract and trust boundary;
- each reviewer model call requires applicable bounded authority;
- canonical CEO issuance is represented by immutable `grantId` plus `manifestHash` binding;
- run_id, Idempotency-Key and request hash are technical execution identities, not grant identities;
- one grant admits at most one model dispatch and cannot auto-release after failure/crash/unknown;
- legacy records cannot be silently upgraded into fresh authority;
- request-time, reviewed, and acceptance-time HEAD are bound;
- model output is untrusted until validated;
- consequential review evidence is durably persisted by trusted Genesis before use;
- Grok/xAI receives zero GitHub write credentials and zero mutation authority;
- actor independence is preserved;
- failure of invocation, validation, grant checks, HEAD checks or persistence fails closed;
- GitHub remains canonical project SoT while Durable Object is the execution-consumption ledger;
- Ready, merge, implementation EA, deploy, secrets, Dify, Broker production calls, Cloudflare, LIVE/model calls, D2 and quarantine removal remain distinct gates.

## 13. Non-goals

This Approved Specification does not implement F2, invoke xAI, deploy anything, change secrets, change Cloudflare, resume authenticated Dify/Broker runtime, remove quarantine, merge a PR, authorize D2, or approve a Bounded Autonomy Envelope.

It does not attempt to solve the separate Codex initial-PR publication limitation.

Crash reconciliation beyond the minimum F2 fail-closed association requirements is a separate implementation/design step: Revision 2 requires enough identity/evidence to make future reconciliation possible, but does not authorize automatic state repair or CAS completion.

## 14. Gates and next step

Current state: **Approved Revision 2 / Execution Authorization NOT_GRANTED**.

Revision 1 was approved on 2026-09-05 against independently reviewed PR #91 HEAD `aa53292d3c7e8063a3da58bbebf7c05dd6f760ca`.

F2 was independently reproduced and durably published in Issue #116 / tests-only Draft PR #117. Draft PR #118 exact HEAD `dcf88f247a5eb92fbec7a48cacb4e6886bfa856c` provided the design review surface. On 2026-09-10 the CEO accepted the design direction `canonical GitHub CEO EA → immutable grantId + manifestHash → durable one-consumption ledger` and separately authorized docs-only canonicalization, implementation allowlist/invariants/tests and independent review.

Next step after exact-HEAD independent review of this Revision 2 canonicalization: return a separate bounded CEO Execution Authorization for implementation using only the Section 10 allowlist. That implementation authorization remains distinct from Ready, merge, production deploy, LIVE, secrets, authenticated Broker calls, DR-0008 quarantine lift and D2.

No Specification Approval or successful review implicitly grants any of those later operations.
