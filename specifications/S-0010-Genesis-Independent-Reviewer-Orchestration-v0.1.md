# S-0010 — Genesis Independent Reviewer Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0010 |
| Title | Genesis Independent Reviewer Orchestration v0.1 |
| Status | **Approved** |
| Revision | 3 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-05 |
| Approval date | 2026-09-14 |
| Approved by | CEO Genesis AI — [approval receipt](https://github.com/kubzik96/genesis-ai/pull/130#issuecomment-5667523404) |
| Related Issue | #89; #116; #131 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1 |
| Related Decisions | DR-0010; DR-0011; DR-0013 Accepted; DR-0008 remains authoritative where applicable |
| Execution Authorization | **NOT_GRANTED** |

## Revision history

| Revision | Date | Change |
|---|---|---|
| 1 | 2026-09-05 | Initial approved reviewer-orchestration contract. |
| 2 | 2026-09-10 | F2 authorization-consumption contract: canonical CEO EA → immutable `grantId` + `manifestHash` → durable one-consumption ledger; strict legacy/cutover and crash-reconciliation boundaries; exact future implementation allowlist and invariants. |
| 3 | 2026-09-14 | Approved trusted GitHub event-adapter contract from Issue #131 / DR-0013: authenticated producer/event identity, immutable command binding, atomic admission, independent default-OFF bridge control, credential separation and durable fail-closed evidence. Revision 3 is CEO-approved; Revision 2 grant-consumption semantics remain unchanged. |

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

Revision 3 defines the minimum trusted GitHub event-adapter boundary needed for a GitHub-capable One-Window controller to request an already-authorized review without possessing Broker or xAI credentials. Revision 3 does not redesign the reviewer, create reviewer authority, install a GitHub App, deploy a webhook adapter, enable LIVE, or authorize any model call.

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

### 3.4 Trusted GitHub event-adapter command contract (Revision 3)

The trusted event adapter is transport and admission only. It MUST NOT mint, refresh, release, widen, reinterpret, or replace reviewer authority.

#### 3.4.1 Closed command envelope and canonical bytes

The sole Revision 3 command wire object is `genesis.review-command.v1`. It MUST be a JSON object with exactly these required members and no optional or unknown members:

```json
{"action":"request_review","commandId":"github-review-command:123","deliveryId":"00000000-0000-4000-8000-000000000000","eventAction":"approved_action","eventName":"approved_event","expectedHeadSha":"0123456789abcdef0123456789abcdef01234567","grantId":"github:issue-comment:123","installationId":123,"issuanceDigest":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","manifestHash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","prNumber":123,"producerAppId":123,"repository":"kubzik96/genesis-ai","version":"genesis.review-command.v1"}
```

Field contract:

- `version` MUST equal `genesis.review-command.v1`; `action` MUST equal `request_review`.
- `commandId` MUST match `^github-review-command:[1-9][0-9]{0,19}$` and is immutable for the command bytes it names.
- `deliveryId` MUST be the lowercase canonical GitHub delivery UUID and match `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- `eventName` and `eventAction` MUST match `^[a-z][a-z0-9_]{0,63}$` and each MUST equal the single separately approved event/action literal; wildcard or caller-selected values are forbidden.
- `producerAppId`, `installationId`, and `prNumber` MUST be positive JSON safe integers, never numeric strings. Producer and installation MUST equal the separately approved dedicated GitHub App identity.
- `repository` MUST equal the case-sensitive literal `kubzik96/genesis-ai`.
- `expectedHeadSha` MUST be exactly 40 lowercase hexadecimal characters; `manifestHash` and `issuanceDigest` MUST each be exactly 64 lowercase hexadecimal characters.
- `grantId` MUST match `^github:issue-comment:[1-9][0-9]*$` and identify an already-issued canonical CEO grant. `issuanceDigest` binds that grant's canonical issuance/provenance bytes; neither value creates authority.

The envelope is closed. A parser MUST reject a non-object root, missing/extra/duplicate member, wrong primitive type, `null`, nested arrays/objects as field values, out-of-range integer, invalid UTF-8, BOM, or any value outside the exact literals/patterns above. Duplicate keys MUST be rejected during tokenization before constructing a language object.

Canonical command bytes are strict UTF-8 JSON with members sorted by ascending Unicode code-point order, no insignificant whitespace, shortest unsigned base-10 integers, and JSON strings whose allowed field values are printable ASCII. The adapter MUST reserialize the validated command and require byte-for-byte equality with the received command bytes. `commandHash` is lowercase hexadecimal `SHA-256(canonical command bytes)`. Any mismatch, noncanonical encoding, or reuse of `commandId` for different bytes is a mutated command and MUST fail closed with zero dispatch.

#### 3.4.2 Authenticated carrier and identity binding

Before parsing the carrier, the adapter MUST verify the GitHub webhook signature over the exact raw HTTP request-body octets using the separately authorized webhook verification material and GitHub-specified signature algorithm/header. Signature verification over reconstructed JSON, decoded/re-encoded content, or only the nested command is invalid.

Only after successful signature verification may the adapter extract the command from the one event-specific location fixed by the later approved implementation contract. The event name/action, command location, repository, producer App ID, installation ID and any sender constraint MUST be closed configuration, not caller-controlled fallbacks.

Verified carrier repository, producer App ID, installation ID, event name, action and delivery UUID MUST exactly equal the command values and their pinned values. Missing, duplicate, ambiguous, forged or mismatched identity/header fields MUST fail closed. Ordinary GitHub writers cannot substitute for the dedicated producer.

#### 3.4.3 Bounded reviewer handoff

Bridge mode extends the existing strict JSON body of authenticated `POST /v1/reviews/grok` by exactly one top-level `bridge` member alongside the still-required `authorization`, `context`, and `run_id`. It creates no new public or unauthenticated model endpoint.

Before constructing any language-level JSON object or performing any `JSON.parse`-equivalent operation, the reviewer boundary MUST tokenize/scan the exact raw UTF-8 request body and reject duplicate top-level occurrences of `authorization`, `context`, `run_id`, or `bridge`. Such duplication MUST fail closed with zero admission and zero reviewer/model dispatch; bridge requests MUST NOT fall back to direct mode after this rejection.

`bridge` MUST be a closed object with exactly these members:

```json
{"version":"genesis.review-bridge.v1","commandId":"github-review-command:123","commandHash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","deliveryId":"00000000-0000-4000-8000-000000000000","producerAppId":123,"installationId":123,"eventName":"approved_event","eventAction":"approved_action"}
```

Every value MUST satisfy the matching Section 3.4.1 rule and MUST come from completed adapter verification, not from an ordinary caller. Unknown/missing/duplicate `bridge` members MUST be rejected. Direct mode remains exactly the existing three-member body and MUST NOT contain `bridge`; bridge mode requires all four top-level members and MUST NOT downgrade to direct mode when bridge metadata is absent or invalid.

The adapter-to-reviewer request MUST use the existing service authentication and existing body/time limits. `authorization` remains the existing grant-bearing reviewer authorization; `context` and `run_id` retain their existing meanings. The canonical reviewer `request_hash` remains the immutable hash of the prepared S-0009 reviewer request; bridge metadata MUST NOT alter its derivation or create a second reviewer operation identity.

#### 3.4.4 Atomic admission and replay semantics

Before model dispatch, one authoritative Durable Object transaction MUST verify command/grant/request agreement and create-or-read an immutable admission record keyed by (`version`, `commandId`, `commandHash`, `deliveryId`, `grantId`, `manifestHash`, `issuanceDigest`). The record MUST also bind producer/installation/event/action, repository, PR, exact expected HEAD, `run_id`, canonical reviewer `request_hash`, and the existing grant-consumption state.

The transaction MUST atomically enforce:

1. the command references a valid, unused, exact-HEAD canonical grant;
2. command and bridge values agree with the authorization and prepared reviewer request;
3. no same `commandId` exists with different hash/tuple;
4. no same delivery is admitted for a different command;
5. no grant already has an admitted/consumed/closed/unknown attempt that would permit another dispatch;
6. only the first valid admission may transition toward dispatch.

Duplicate exact replay may return only the previously stored immutable outcome/evidence reference; it MUST NOT dispatch again. Any mutated/replayed/raced/stale/wrong-target/invalid-grant/closed/ambiguous case produces zero additional model requests. If admission, dispatch, result persistence or finalization is uncertain, state MUST become/remain `UNKNOWN`; only read-only reconciliation is permitted.

#### 3.4.5 Controls, credentials and durable evidence

The bridge MUST have an explicit independent default-OFF control. Bridge OFF means zero event-adapter reviewer dispatch even if reviewer LIVE is enabled. Reviewer OFF means zero xAI/Grok dispatch even if bridge admission would otherwise succeed.

The One-Window controller MUST hold neither `BROKER_SERVICE_TOKEN` nor `XAI_API_KEY`. The adapter may hold only separately authorized webhook-verification material and the least privilege credential required to reach the existing authenticated reviewer boundary. The reviewer runtime retains the xAI credential. Grok/xAI receives no GitHub mutation or Broker credential.

Terminal bridge evidence intended to influence a consequential gate MUST durably bind at minimum: command version/ID/hash, delivery ID, producer App/installation/event/action, `grantId`, `manifestHash`, `issuanceDigest`, repository, PR, exact expected/reviewed/acceptance-time HEAD, `run_id`, canonical reviewer `request_hash`, terminal admission/consumption state, normalized S-0009 result, and durable GitHub persistence/read-back receipt. Missing or conflicting evidence is non-gate-safe and MUST NOT allow a second model request.

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

Revision 3 additionally requires event-adapter initiated evidence to bind the complete Section 3.4.5 command/delivery/admission identity so the persisted result proves exactly which authenticated command consumed which grant and reviewer operation. Read-back MUST reproduce the same command/grant/request/HEAD binding before the evidence is gate-safe.

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
12. an event-adapter invocation has an untrusted/forged producer, bad event authentication, wrong repo/installation/action, malformed/noncanonical/mutated command, command/hash/delivery mismatch, duplicate/replayed/raced delivery, stale target, invalid grant/provenance, bridge OFF, reviewer OFF, or uncertain admission/persistence;
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

DR-0013 is the CEO-accepted Decision Record for the Revision 3 trust boundary. Acceptance and Revision 3 approval are recorded in the approval receipt; implementation authority remains NOT_GRANTED.

## 10. Implementation boundary after Approval

Revision 3 approval does NOT itself grant implementation authority. A separate Execution Authorization MUST name exact base/HEAD preconditions, executor and exact file allowlist for any trusted event-adapter implementation.

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
3. Invalid raw-body webhook signature, wrong repository, wrong GitHub App installation/producer, wrong sender/action where pinned, or malformed command produces zero dispatch.
4. Missing/extra/duplicate command keys, wrong primitive types, invalid UTF-8, noncanonical JSON, mutated `commandId`, `commandHash`, delivery identity, repository/PR/exact HEAD, `grantId`, `manifestHash` or issuance provenance produces zero dispatch.
5. `commandId` reused with different canonical bytes/hash or delivery ID reused for another command produces zero dispatch.
6. Direct mode rejects `bridge`; bridge mode requires the exact closed `genesis.review-bridge.v1` object and cannot silently downgrade to direct mode.
7. Bridge metadata reaching the reviewer runtime exactly matches authenticated adapter output and the Durable Object admission tuple.
8. Duplicate exact delivery/command replay returns only previously stored immutable evidence/outcome and causes zero additional model dispatch.
9. Concurrent race for one command/grant admits at most one model dispatch total.
10. Stale or changed exact HEAD blocks before dispatch and does not release/recycle authority.
11. Already consumed/closed/UNKNOWN grant or command state produces zero additional dispatch.
12. Bridge default-OFF produces zero reviewer dispatch even when reviewer LIVE is enabled.
13. Reviewer OFF produces zero xAI/Grok dispatch even when bridge admission is otherwise valid.
14. The One-Window controller can request the trusted command without possessing `BROKER_SERVICE_TOKEN` or `XAI_API_KEY`.
15. The adapter invokes only the existing authenticated reviewer execution boundary; no unauthenticated public model path is introduced.
16. Crash or uncertain persistence after admission/dispatch cannot produce a second model call; only read-only reconciliation is allowed.
17. Consequential evidence is unusable until durable GitHub persistence/read-back reproduces the exact command/delivery/grant/request/PR/HEAD binding.
18. Duplicate top-level `authorization`, `context`, `run_id`, or `bridge` keys are rejected from the raw reviewer handoff body before object construction in both direct and bridge modes, with zero admission/model dispatch and no bridge-to-direct fallback.

Any real GitHub App install, webhook deployment, authenticated Broker call or LIVE reviewer invocation remains separately gated.

## 12. Acceptance criteria

Revision 3 approval records the following acceptance requirements:

- Revision 2 grant-consumption semantics remain unchanged as the approved grant-consumption baseline;
- S-0009/DR-0011 remain the reviewer contract and reviewer execution boundary;
- ordinary GitHub write authority is not reviewer-execution authority;
- only the dedicated authenticated trusted producer/event path may submit executable bridge commands;
- the exact `genesis.review-command.v1` envelope, canonical serialization and `commandHash` rules are normative and closed;
- raw-body carrier authentication and pinned producer/repository/installation/event/action identity are required before command parsing/admission;
- the existing authenticated `POST /v1/reviews/grok` bridge handoff uses the exact closed `genesis.review-bridge.v1` extension and cannot downgrade to direct mode;
- commands bind an already-issued canonical grant and cannot mint/refresh/release authority;
- command + hash + delivery + grant + repo/PR/exact HEAD + reviewer request identity are atomically admitted before dispatch;
- duplicate/replay/race/UNKNOWN/stale/invalid/mutated cases produce zero additional model dispatches;
- bridge and reviewer LIVE have independent explicit default-OFF controls;
- the One-Window controller holds neither Broker nor xAI credentials;
- consequential evidence durably binds and read-back verifies command, delivery, grant, request, PR and exact HEAD before gate use;
- GitHub remains canonical project SoT while Durable Object remains execution-consumption/admission state;
- Ready, merge, implementation EA, GitHub App install, webhook deploy, secrets, Dify, Broker production calls, Cloudflare, bridge/LIVE/model calls, D2 and quarantine removal remain distinct later gates.

## 13. Non-goals

This Approved Revision 3 does not implement the trusted event adapter, install a GitHub App, deploy a webhook, invoke xAI, make an authenticated Broker request, enable bridge/reviewer LIVE, change secrets, change Cloudflare, resume authenticated Dify/Broker runtime, remove quarantine, mark Ready, merge a PR, authorize D2, or approve a Bounded Autonomy Envelope.

It does not grant ordinary GitHub writers reviewer-execution authority and does not make the trusted event adapter a new source of reviewer authority.

## 14. Gates and next step

Current state: **Revision 3 / Approved / Execution Authorization NOT_GRANTED**. Revision 3 is CEO-approved; Revision 2 grant-consumption semantics remain unchanged.

DR-0013 is CEO-accepted in Draft PR #130 and has independent Qodo evidence on its exact reviewed HEAD. Issue #131 defines the bounded normative delta represented by this Revision 3 candidate.

Next step: verify exact-HEAD review evidence after approval metadata synchronization, then obtain separate exact Ready/merge authorization for the documentation PRs. CEO approval of Revision 3 and acceptance of DR-0013 remain distinct from implementation authorization. A subsequent bounded implementation EA must name exact base/HEAD, exact implementation/test/config allowlist and retain separate deployment, GitHub App installation, secrets, bridge/LIVE and first real Grok-call gates.

No Specification Approval or successful review implicitly grants any of those later operations.