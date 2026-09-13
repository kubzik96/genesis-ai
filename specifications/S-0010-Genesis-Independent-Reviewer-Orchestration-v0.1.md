# S-0010 — Genesis Independent Reviewer Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0010 |
| Title | Genesis Independent Reviewer Orchestration v0.1 |
| Status | **In Review** |
| Revision | 3 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-05 |
| Approval date | — (Revision 3 not approved) |
| Approved by | — (Revision 2 remains the latest CEO-approved revision) |
| Related Issue | #89; #116; #131 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1 |
| Related Decisions | DR-0010; DR-0011; DR-0013 Proposed; DR-0008 remains authoritative where applicable |
| Execution Authorization | **NOT_GRANTED** |

## Revision history

| Revision | Date | Change |
|---|---|---|
| 1 | 2026-09-05 | Initial approved reviewer-orchestration contract. |
| 2 | 2026-09-10 | F2 authorization-consumption contract: canonical CEO EA → immutable `grantId` + `manifestHash` → durable one-consumption ledger; strict legacy/cutover and crash-reconciliation boundaries; exact future implementation allowlist and invariants. |
| 3 | 2026-09-14 | Proposed trusted GitHub event-adapter contract from Issue #131 / DR-0013: authenticated producer/event identity, immutable command binding, atomic admission, independent default-OFF bridge control, credential separation and durable fail-closed evidence. Revision 2 remains the latest CEO-approved revision. |

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

Revision 3 proposes the minimum trusted GitHub event-adapter boundary needed for a GitHub-capable One-Window controller to request an already-authorized review without possessing Broker or xAI credentials. Revision 3 does not redesign the reviewer, create reviewer authority, install a GitHub App, deploy a webhook adapter, enable LIVE, or authorize any model call.

## 2. Canonical boundaries

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. `MEMORY.md` remains a recovery index, not a second Source of Truth.

S-0009 Revision 1 and DR-0011 remain authoritative for reviewer identity, exact-HEAD binding, output invariants, actor independence, zero GitHub mutation authority for Grok/xAI, and fail-closed review semantics.

S-0010 MUST NOT give Grok/xAI GitHub PATs, repository write credentials, Broker service tokens, or any capability to mutate GitHub. Durable persistence is performed only by the trusted Genesis side after validation and acceptance-time exact-HEAD verification.

Ordinary GitHub repository write authority is not reviewer-execution authority. Issue comments, PR comments, labels, branch pushes, ordinary repository writes, review approvals, tests, or agent output MUST NOT by themselves become executable reviewer authority.

The token-economy routing preference is advisory: Grok/xAI is preferred for consequential independent review, architecture, security, disputed decisions, and important gate evidence; routine read-only checks, minor housekeeping, and ordinary diagnostics SHOULD avoid unnecessary xAI spend. This routing rule does not create standing LIVE/model-call authority.

DR-0008 remains fully authoritative. Nothing in Revision 3 lifts quarantine, authorizes an authenticated production Broker call, enables LIVE, deploys a Worker or webhook adapter, installs a GitHub App, mutates secrets, or authorizes D2.

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

### 3.4 Trusted GitHub event-adapter command contract (Revision 3 proposal)

The trusted event adapter is transport and admission only. It MUST NOT mint, refresh, release, widen, reinterpret, or replace reviewer authority.

An executable bridge command is admissible only when all of the following are true before model dispatch:

1. The producer is the dedicated, separately approved GitHub App identity selected by DR-0013; ordinary repository writers are not trusted producers.
2. The event carrier is cryptographically authenticated and the adapter verifies the expected repository, installation/producer identity, sender identity where available, closed event/action type, and unique delivery identity.
3. The command has a versioned closed schema and immutable `commandId`.
4. The command binds exact repository, PR number, expected 40-character HEAD, `grantId`, `manifestHash`, and canonical authorization provenance/issuance digest sufficient to verify the already-issued grant.
5. The command may reference only an already-issued canonical CEO reviewer grant. It MUST NOT create a grant or convert any GitHub write into model-call authority.
6. The adapter and authoritative Durable Object admission MUST atomically bind `commandId` + delivery identity + canonical grant + repository/PR/exact HEAD + immutable request/operation identity before any model dispatch.
7. Duplicate, replayed, concurrently raced, mutated, stale-HEAD, wrong-target, invalid-grant, already-consumed, closed, or ambiguous commands MUST produce zero additional model requests.
8. If admission, dispatch status, durable evidence, or finalization is uncertain, the state MUST become/remain fail-closed `UNKNOWN`; only read-only reconciliation is permitted and no second model request is allowed.
9. The bridge MUST have an explicit independent default-OFF control. Bridge OFF means zero reviewer dispatch from the event adapter even if reviewer LIVE is enabled. Reviewer LIVE/OFF remains a separate control; reviewer OFF means zero xAI/Grok dispatch even if the bridge is enabled.
10. The One-Window controller MUST hold neither `BROKER_SERVICE_TOKEN` nor `XAI_API_KEY`. The adapter may hold only the credentials separately authorized for its bounded role; the existing reviewer runtime retains the xAI credential.
11. The existing authenticated reviewer runtime and `POST /v1/reviews/grok` remain the sole reviewer execution boundary. Revision 3 creates no public unauthenticated model endpoint.
12. A terminal result intended to influence a consequential gate MUST be durably persisted/read back and bind the trusted command identity, canonical grant, repository/PR and exact reviewed HEAD.

## 4. Review invocation contract

Genesis MUST reuse the existing S-0009 reviewer transport and validation contract unless a later separately approved specification authorizes a material change.

For each authorized review operation:

1. Verify repository identity and exact PR HEAD.
2. Validate canonical `grantId`/`manifestHash` binding and ensure the grant is admissible before model dispatch.
3. If invocation arrives through the Revision 3 event adapter, validate the complete Section 3.4 command/authentication/admission contract before dispatch.
4. Collect only bounded changed-file metadata, unified diff, canonical task/specification context, and explicit review criteria required for the decision.
5. Exclude secrets, tokens, authorization headers, unrelated repository context, private payloads, and raw sensitive logs.
6. Invoke `grok-4.3` through the approved reviewer transport with exactly one request, retries `0`, streaming disabled, tools disabled, and configured byte/time/output bounds.
7. Validate the response against the S-0009 closed schema and cross-field invariants.
8. Re-fetch the current PR HEAD after review and require equality with the expected and reviewed SHA values.
9. Normalize any transport, schema, producer/event identity, command identity, grant-consumption, scope, authorization, persistence, or HEAD ambiguity to a non-gate-safe blocked result.

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

Revision 3 additionally requires event-adapter initiated evidence to bind a versioned trusted command identity and verified delivery/admission identity sufficient to prove which admitted command consumed the grant.

Immediately before persistence, Genesis MUST complete the acceptance-time exact-HEAD check. If the HEAD changed, the result is stale and MUST NOT be persisted as positive gate evidence.

Persistence MUST occur through a trusted Genesis GitHub write boundary. Grok/xAI itself receives no write capability.

A GitHub evidence record and Durable Object execution ledger have distinct roles: GitHub remains canonical project evidence/SoT; the Durable Object is the authoritative execution-consumption ledger and MUST NOT become a competing project/governance SoT.

## 6. One-window orchestration requirement

The target product behavior is that the CEO does not need to copy commands, run local scripts, move review output manually, or re-enter the same bounded context after granting a valid review authorization.

After authorization, Genesis SHOULD autonomously complete all non-consequential orchestration steps that are already allowed by the authorization and supported by available tools:

- exact-HEAD read verification;
- canonical grant binding verification;
- trusted event/command verification and atomic admission when the Revision 3 bridge is used;
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
12. an event-adapter invocation has an untrusted/forged producer, bad event authentication, wrong repo/installation/action, malformed or mutated command, duplicate/replayed/raced delivery, stale target, invalid grant/provenance, bridge OFF, reviewer OFF, or uncertain admission/persistence;
13. a requested action would silently expand into Ready, merge, remediation, deployment, secrets, Dify, Broker, Cloudflare, quarantine removal, another model call, or another control plane.

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
- GitHub App installation or webhook/event-adapter deployment;
- bridge enablement;
- secrets creation, inspection, transfer, rotation, or replacement;
- DR-0008 quarantine removal;
- modification of the S-0005 writer authority;
- a public unauthenticated reviewer/model endpoint;
- authority for ordinary GitHub writers to trigger reviewer execution.

DR-0013 is the proposed Decision Record for the Revision 3 trust boundary. Until it is accepted and Revision 3 is independently reviewed and CEO-approved, implementation MUST NOT treat the proposed adapter boundary as operational authority.

## 10. Implementation boundary after Approval

Revision 3 approval, if later granted, does NOT itself grant implementation authority. A separate Execution Authorization MUST name exact base/HEAD preconditions, executor and exact file allowlist for any trusted event-adapter implementation.

The Revision 2 **maximum implementation allowlist for the bounded F2 code fix** remains historical and unchanged:

### Production/runtime source

- `services/genesis-broker/src/reviewer-orchestrator.js`
- `services/genesis-broker/src/reviewer-runtime.js`
- `services/genesis-broker/src/durable-object.js`

### Tests

- **creation or update explicitly permitted for the Revision 2 F2 fix only:** `services/genesis-broker/tests/reviewer-authorization-reproduction.test.js`.
- `services/genesis-broker/tests/reviewer-orchestrator.test.js`
- `services/genesis-broker/tests/reviewer-runtime.test.js`
- `services/genesis-broker/tests/durable-object.test.js`

That Revision 2 allowlist MUST NOT be interpreted as pre-authorization for the Revision 3 bridge. In particular, event/webhook routes, GitHub App configuration, `src/index.js`, `src/do-proxy-store.js`, `wrangler.toml`, migrations, Cloudflare configuration, secrets, Dify, S-0005 writer code and GitHub credential handling remain OUTSIDE any Revision 3 implementation authority until a later explicit bounded gate names them.

No deployment, GitHub App installation, webhook activation, bridge enablement, reviewer LIVE enablement or first production-runtime invocation is authorized by this specification.

## 11. Verification requirements

Before any Revision 3 implementation may be considered review-ready, non-consequential local/mock verification MUST preserve every Revision 2/S-0009 invariant and demonstrate at minimum:

### Existing S-0010 / F2 invariants

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
- same canonical grant across changed run/key identities remains at most one model dispatch;
- concurrent requests for the same grant admit at most one dispatch;
- crash/UNKNOWN cannot make a grant reusable;
- arbitrary caller-supplied `grantId` is rejected;
- `manifestHash`/issuance-provenance mismatch blocks before dispatch;
- legacy records cannot fall through to fresh execution;
- existing F1 stale-positive replay protection remains green;
- no automatic Ready, merge, remediation, deploy, Dify, Broker, Cloudflare, secrets, or quarantine action occurs.

### Revision 3 trusted-event-adapter invariants

1. Ordinary issue/PR comments, labels, branch pushes and repository writes cannot trigger reviewer execution.
2. Forged or untrusted producer identity produces zero reviewer/model dispatch.
3. Invalid webhook/event authentication, wrong repository, wrong GitHub App installation/producer, wrong sender/action where pinned, or malformed command produces zero dispatch.
4. Missing or mutated `commandId`, delivery identity, repository/PR/exact HEAD, `grantId`, `manifestHash` or issuance provenance produces zero dispatch.
5. Duplicate delivery, replayed command or concurrent race for one command/grant admits at most one model dispatch total.
6. Stale or changed exact HEAD blocks before dispatch and does not release/recycle authority.
7. Already consumed/closed/UNKNOWN grant or command state produces zero additional dispatch.
8. Bridge default-OFF produces zero reviewer dispatch even when reviewer LIVE is enabled.
9. Reviewer OFF produces zero xAI/Grok dispatch even when bridge admission is otherwise valid.
10. The One-Window controller can construct/request the trusted command without possessing `BROKER_SERVICE_TOKEN` or `XAI_API_KEY`.
11. The adapter invokes only the existing authenticated reviewer execution boundary; no unauthenticated public model path is introduced.
12. Crash or uncertain persistence after admission/dispatch cannot produce a second model call; only read-only reconciliation is allowed.
13. Consequential evidence is unusable until durable GitHub persistence/read-back binds command, grant, PR and exact HEAD.

Any real GitHub App install, webhook deployment, authenticated Broker call or LIVE reviewer invocation remains separately gated.

## 12. Acceptance criteria

Revision 3 may be approved only with all of the following explicit:

- Revision 2 grant-consumption semantics remain unchanged and remain the latest already-approved baseline;
- S-0009/DR-0011 remain the reviewer contract and reviewer execution boundary;
- ordinary GitHub write authority is not reviewer-execution authority;
- only the dedicated authenticated trusted producer/event path may submit executable bridge commands;
- commands bind an already-issued canonical grant and cannot mint/refresh/release authority;
- command + delivery + grant + repo/PR/exact HEAD are atomically admitted before dispatch;
- duplicate/replay/race/UNKNOWN/stale/invalid cases produce zero additional model dispatches;
- bridge and reviewer LIVE have independent explicit default-OFF controls;
- the One-Window controller holds neither Broker nor xAI credentials;
- existing authenticated `POST /v1/reviews/grok` remains the sole reviewer execution boundary;
- consequential evidence durably binds command, grant, PR and exact HEAD before gate use;
- GitHub remains canonical project SoT while Durable Object remains execution-consumption/admission state;
- Ready, merge, implementation EA, GitHub App install, webhook deploy, secrets, Dify, Broker production calls, Cloudflare, bridge/LIVE/model calls, D2 and quarantine removal remain distinct later gates.

## 13. Non-goals

This In Review Revision 3 does not implement the trusted event adapter, install a GitHub App, deploy a webhook, invoke xAI, make an authenticated Broker request, enable bridge/reviewer LIVE, change secrets, change Cloudflare, resume authenticated Dify/Broker runtime, remove quarantine, mark Ready, merge a PR, authorize D2, or approve a Bounded Autonomy Envelope.

It does not grant ordinary GitHub writers reviewer-execution authority and does not make the trusted event adapter a new source of reviewer authority.

## 14. Gates and next step

Current state: **Revision 3 / In Review / Execution Authorization NOT_GRANTED**. Revision 2 remains the latest CEO-approved revision.

DR-0013 remains Proposed in Draft PR #130 and has independent Qodo evidence on its exact reviewed HEAD. Issue #131 defines the bounded normative delta represented by this Revision 3 candidate.

Next step: independently review the exact GitHub-published Revision 3 candidate together with its DR-0013 dependency. Any later CEO approval of Revision 3 and acceptance of DR-0013 remain distinct from implementation authorization. A subsequent bounded implementation EA must name exact base/HEAD, exact implementation/test/config allowlist and retain separate deployment, GitHub App installation, secrets, bridge/LIVE and first real Grok-call gates.

No Specification Approval or successful review implicitly grants any of those later operations.