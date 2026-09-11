# S-0011 — Genesis Universal Adaptive Agent Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0011 |
| Title | Genesis Universal Adaptive Agent Orchestration v0.1 |
| Status | **In Review** |
| Revision | 3 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date (GitHub UTC) | 2026-09-10 |
| Revision 1 approval date | 2026-09-11 |
| Revision 1 approved by | CEO Genesis AI |
| Revision 2 approval date | 2026-09-11 |
| Revision 2 approved by | CEO Genesis AI |
| Revision 3 approval | NOT_GRANTED — fresh exact-HEAD CEO Approval required |
| Related Issue | #121 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1; S-0010 Revision 2 |
| Related Decisions | DR-0005; DR-0008; DR-0010; DR-0011 |
| Execution Authorization | **NOT_GRANTED — implementation requires separate CEO EA** |

## Revision history

| Revision | Date | Status | Change |
|---|---|---|---|
| 1 | 2026-09-10/11 | Approved | Initial implementation-grade contract; CEO-approved after independent review. |
| 2 | 2026-09-11 | **Approved** | Non-scope-expanding correctness hardening after post-approval exact-HEAD Qodo review: exact attempt correlation, canonical descriptor/event hashing, full S-0010 grant provenance and terminal lifecycle, canonical S-0009 result enums, deterministic routing tie-breaks, monotonic event semantics including cancellation and authoritative UNKNOWN reconciliation, explicit FAILED_NO_DISPATCH terminality, race-safe event acceptance, crash-resumable continuation checkpoints, and mandatory approved Decision Record before implementation. CEO approval was recorded for Revision 2 on exact HEAD `81c8859d29adc666e5ac0c1d957dd83f8e3daadb` on 2026-09-11; the later Qodo result exposed the external-effect replay gap addressed in Revision 3. |
| 3 | 2026-09-11 | **In Review** | Bounded correction of the external-effect crash/replay gap: stable per-effect operation identity, trusted destination classification A/B/C, pre-dispatch durable admission, transactional completion or destination idempotency, and fail-closed indeterminate-effect reconciliation. Follow-up hardening specifies initial-dispatch admission, per-episode lifecycle/aggregate state and delimiter-safe event identity. Existing Revision 2 requirements and mandatory approved Decision Record remain. No approval carries forward. |

Revision 3 preserves the existing product scope and adds no runtime/implementation authority. It clarifies the safety boundary of the existing at-most-once requirement rather than promising automatic completion after every external-effect crash. Historical Revision 1/2 approvals do not approve Revision 3.

## 1. Purpose and product result

Genesis becomes a provider-neutral orchestration layer: CEO states a goal once; Genesis derives bounded requirements, observes admissible providers, chooses deterministically, dispatches only under applicable authority, learns completion through normalized events, validates exact task/run/attempt/PR/HEAD evidence, and continues only already-authorized non-consequential work until the next CEO gate.

Target flow:

```text
CEO goal
→ trusted task/authority envelope
→ trusted provider registry + resource snapshots
→ hard governance filter
→ deterministic ranking
→ durable attempt + authority reservation
→ provider adapter dispatch
→ normalized/correlated event
→ result/review validation
→ trusted GitHub evidence
→ next already-authorized step OR CEO gate
```

`Astra`, `Codex`, `Copilot`, `Qodo`, `Grok/xAI`, `Jules` and future providers are adapters, not core architecture dependencies. `Julius` is only a legacy alias of `Jules`, never a distinct security identity.

## 2. Canonical boundaries

1. GitHub `kubzik96/genesis-ai` remains the durable project Source of Truth.
2. Runtime cache/Durable Object/queue may store delivery, dedupe, attempt, dispatch, resource, continuation-checkpoint and reconciliation state only; it is not a competing project/governance SoT.
3. Provider registration, selection, completion or success never creates authority.
4. Ready, merge, remediation, deploy, LIVE, secret/PAT mutation, Dify and DR-0008 lift remain separate gates unless a later approved autonomy policy explicitly says otherwise.
5. Paid or more-privileged fallback requires applicable authority and budget policy; no automatic escalation.
6. Unknown quota/reset/cost/health/identity/authority data is represented as `UNKNOWN`, never guessed.
7. DR-0008 remains authoritative; S-0011 alone authorizes no production Broker/xAI/Dify/Cloudflare action.
8. S-0009/S-0010 remain authoritative for independent reviewer identity, canonical CEO grant, one-consumption lifecycle, exact-HEAD validation, closed review schema and trusted GitHub review evidence.

## 3. Trusted Provider Registry

### 3.1 ProviderDescriptor

```json
{
  "provider_id": "string",
  "adapter_id": "string",
  "model_id": "string|null",
  "aliases": ["string"],
  "capabilities": ["coding", "review", "research", "architecture"],
  "roles": ["executor", "independent_reviewer", "advisor"],
  "independence_class": "string",
  "invocation_modes": ["github", "api", "plugin", "local"],
  "permissions_class": "read_only|bounded_write|privileged",
  "cost_class": "free|metered|unknown",
  "registry_revision": "string",
  "registry_authority_ref": "github:commit-or-blob-ref",
  "descriptor_hash": "64-char lowercase sha256"
}
```

Rules:

- `provider_id + adapter_id` is the stable security identity; aliases never change it.
- Security-sensitive `roles`, `independence_class`, `permissions_class`, `cost_class` and invocation modes come from versioned GitHub registry material, not provider self-description.
- Runtime `describe()` may report operational facts but cannot elevate role, independence or permissions.
- Missing, stale, malformed or conflicting registry provenance blocks security-sensitive/consequential selection.
- New provider = canonical descriptor + adapter; core routing algorithm must not require provider-name branching.

### 3.2 Canonical descriptor hash

`descriptor_hash` is **excluded** from its own hash preimage.

Canonical preimage is the descriptor with exactly these keys in lexicographic key order:

`adapter_id, aliases, capabilities, cost_class, independence_class, invocation_modes, model_id, permissions_class, provider_id, registry_authority_ref, registry_revision, roles`.

Canonicalization:

- JSON strings use normal JSON UTF-8 escaping; `null` is JSON `null`.
- Arrays `aliases`, `capabilities`, `invocation_modes`, `roles` are treated as sets: reject duplicates, sort unique UTF-8 strings lexicographically before serialization.
- No whitespace is emitted outside JSON strings.
- Encode canonical JSON as UTF-8; hash SHA-256; encode as 64 lowercase hexadecimal characters.
- Unknown/additional keys in canonical registry descriptors fail closed until a later revision defines them.

Implementation tests MUST contain at least one fixed canonical JSON → expected SHA-256 vector and prove object-key/allowed-set input permutations hash identically.

## 4. Resource awareness

### 4.1 ResourceSnapshot

```json
{
  "provider_id": "string",
  "adapter_id": "string",
  "observed_at": "RFC3339",
  "availability": "AVAILABLE|DEGRADED|UNAVAILABLE|UNKNOWN",
  "invokable": "YES|NO|UNKNOWN",
  "quota_remaining": "number|null",
  "quota_unit": "requests|tokens|credits|null",
  "quota_state": "AVAILABLE|EXHAUSTED|UNKNOWN",
  "rate_limit_state": "CLEAR|RATE_LIMITED|UNKNOWN",
  "reset_at": "RFC3339|null",
  "cooldown_until": "RFC3339|null",
  "estimated_cost_minor_units": "integer|null",
  "currency": "ISO-4217|null",
  "cost_basis": "per_invocation_estimate|provider_quote|null",
  "latency_ms": "number|null",
  "credential_ready": "YES|NO|UNKNOWN",
  "evidence": ["non-secret provider/GitHub/runtime reference"]
}
```

Rules:

- Numeric values are recorded only from evidence defined by the adapter contract.
- Snapshot freshness TTL is routing policy, not provider-controlled.
- Stale snapshot never becomes AVAILABLE implicitly.
- Secret values are forbidden; only readiness state may appear.
- Metered provider is inadmissible unless compatible `estimated_cost_minor_units + currency` are proven and within cap.
- v0.1 performs no currency conversion; task budget and estimate currency must match exactly.

## 5. Normalized Agent Events

### 5.1 Event schema

```json
{
  "source_namespace": "trusted-source-namespace",
  "event_id": "stable-source-local-event-id",
  "event_type": "AGENT_SELECTED|AGENT_STARTED|AGENT_WAITING|AGENT_COMPLETED|AGENT_FAILED|AGENT_CANCELLED|REVIEW_STARTED|REVIEW_COMPLETED|LIMIT_EXHAUSTED|RATE_LIMITED|RESET_AT|PROVIDER_UNAVAILABLE",
  "provider_id": "string",
  "adapter_id": "string",
  "task_id": "string",
  "run_id": "string",
  "attempt_id": "string|null",
  "external_job_id": "string|null",
  "reconciliation_key": "string|null",
  "provider_sequence": "non-negative-integer|null",
  "repository": "owner/repo|null",
  "pr_number": "number|null",
  "head_sha": "40-char sha|null",
  "occurred_at": "RFC3339",
  "source": "github_webhook|provider_webhook|callback|status_api|polling",
  "evidence_ref": "string|null"
}
```

`source_namespace` comes from trusted adapter configuration, never caller payload.

Terminal/dispatch-derived events `AGENT_COMPLETED`, `AGENT_FAILED`, `AGENT_CANCELLED` and `REVIEW_COMPLETED` MUST have non-null `attempt_id`. If the provider supplies `external_job_id` or `reconciliation_key`, the terminal event must carry the corresponding value and it MUST equal the durable InvocationReceipt before state mutation or continuation. A terminal event without required correlation is BLOCKED. Null `attempt_id` is allowed only for observations that are provably not tied to a dispatched attempt, such as provider-wide quota/rate-limit state.

`AGENT_CANCELLED` is a terminal operational outcome only when cancellation has been proven by provider-supported acknowledgement/read-back for the exact receipt identity. A cancellation request by itself is not cancellation evidence. If cancellation outcome is ambiguous, the attempt becomes `UNKNOWN`, not `CANCELLED`. Cancellation does not restore or mint authority, does not make a consumed S-0010 grant reusable, and does not imply `FAILED_NO_DISPATCH` unless non-dispatch is separately proven under the canonical grant lifecycle.

### 5.2 Canonical event identity, payload hash and race-safe acceptance

Canonical dedupe key:

```text
source_namespace + "\n" + provider_id + "\n" + adapter_id + "\n" + event_id
```

Before this concatenation, all four identity components MUST be non-empty well-formed Unicode scalar strings without U+0000–U+001F or U+007F control characters; in particular LF and CR are rejected, never stripped or escaped into a different identity. Apply the same provider/adapter identity validation when admitting registry material, adapter configuration and events. Identity comparison uses exact UTF-8 bytes with no trimming, case folding or Unicode normalization. Reject malformed components before dedupe lookup or mutation. Excluding the LF delimiter from every component makes this fixed four-component encoding unambiguous; fixed negative tests MUST cover delimiter injection across adjacent components.

The canonical payload hash excludes no semantic event field except no separately stored hash field exists in the schema. Preimage contains exactly all event schema fields above, in lexicographic key order. Rules:

- JSON object keys lexicographically ordered.
- Strings and `null` encoded as canonical compact JSON values.
- Numeric `provider_sequence` is an integer JSON number only; no floating/exponential equivalent accepted.
- No whitespace outside strings.
- UTF-8 bytes → SHA-256 → lowercase hex.
- Schema rejects additional keys before hashing.

Same canonical dedupe key + same **accepted** payload hash is an idempotent replay. If the accepted event's durable continuation checkpoint is `PENDING` or `IN_PROGRESS`, replay MUST recover that same checkpoint subject to Section 5.4 effect safety, rather than dispatching a second continuation; if checkpoint is `COMPLETED`, replay is a no-op. Same accepted key + different hash = conflict/fail closed. Different providers/adapters with equal local `event_id` do not collide. Implementation tests MUST use shared fixed vectors proving key-order-independent normalization of semantically identical events.

For dispatch-derived/terminal events, canonical key/hash calculation may occur before receipt correlation, but **accepted dedupe state MUST NOT be durably committed before exact receipt correlation and attempt-state admission succeed**. Event acceptance is atomic with the corresponding attempt-state transition **and creation/update of a durable idempotent continuation checkpoint for that exact accepted event**. The checkpoint is bound to `dedupe key + payload hash + task_id + run_id + attempt_id`, starts as `PENDING`, and records whether post-acceptance validation/evidence/continuation is incomplete, in progress, completed or blocked. If a callback arrives before the durable receipt contains the provider external/reconciliation identity needed to prove correlation, the event is quarantined/pending or rejected-for-retry without marking its dedupe key as accepted. A later redelivery after receipt identity persistence must therefore remain processable. A pending/quarantined pre-acceptance record is operational delivery state only, expires only under bounded policy, and can never authorize continuation.

Accepted-event checkpoint rules:

- `PENDING → IN_PROGRESS → COMPLETED|BLOCKED|UNKNOWN` is the checkpoint lifecycle. `UNKNOWN` quarantines an indeterminate effect and permits only authoritative read-only reconciliation under Section 5.4; it cannot trigger replay. A reconciled checkpoint may resume only its same authorized remaining work after durable exact-effect resolution. `COMPLETED` is terminal; `BLOCKED` needs applicable explicit reevaluation policy, never implicit retry.
- Claiming/resuming a checkpoint MUST use atomic single-owner admission and fencing under Section 5.4. Local ownership alone does not deduplicate a remote effect.
- Crash after accepted-state commit retains the checkpoint and every admitted effect record. Redelivery/reconstruction recovers durable facts: safe remaining work may resume, but possible external effects are reconciled or quarantined under Section 5.4. It neither silently loses the checkpoint nor assumes its unfinished effect is repeatable.
- `COMPLETED` is written only after the authorized continuation outcome or explicit no-next-step result is durably recorded. `BLOCKED` is written only with a durable fail-closed reason and does not itself grant retry/authority.
- Resumption MUST re-read current GitHub task/PR/HEAD and applicable authority; stale/revoked conditions block continuation rather than replaying an obsolete decision.
- The checkpoint is operational recovery state, not project SoT and not authority. It cannot create a second invocation, grant, Ready/merge/deploy/LIVE permission or any action outside the already-authorized next step.

If the provider offers a caller-supplied idempotency/correlation key before dispatch, Genesis SHOULD persist that non-secret stable key in `PREPARED` and require callbacks to echo it. If the provider only assigns external identity after dispatch, the race-safe pending/correlation rule above is mandatory.

### 5.3 Per-attempt monotonic state

Event dedupe alone is insufficient. Core maintains a durable operational state machine per `attempt_id`:

```text
PREPARED
  → FAILED_NO_DISPATCH
  → DISPATCH_CONFIRMED
  → WAITING
  → COMPLETED | FAILED | CANCELLED | UNKNOWN
```

The diagram denotes allowed outcomes, not a mandatory linear traversal: `PREPARED → FAILED_NO_DISPATCH` is terminal when non-dispatch is proven; `PREPARED → DISPATCH_CONFIRMED` is the dispatch path; `DISPATCH_CONFIRMED → COMPLETED|FAILED|CANCELLED|UNKNOWN` is allowed directly; `WAITING` may repeat as observation without regressing state.

`COMPLETED`, `FAILED`, `CANCELLED`, and `FAILED_NO_DISPATCH` are terminal/non-regressible for autonomous continuation. `UNKNOWN` is **quarantined and non-autonomously-continuable**, but is not permanently non-switchable: only read-only authoritative reconciliation for the exact attempt/receipt may resolve operational `UNKNOWN` to the single proven outcome `COMPLETED`, `FAILED`, `CANCELLED`, or `FAILED_NO_DISPATCH` when the required evidence proves that outcome. Ordinary provider events cannot reopen or switch `UNKNOWN`, and reconciliation can never create a second continuation.

For S-0010-bound work, resolving operational `UNKNOWN` does not restore or mint grant authority. The canonical grant lifecycle remains independently authoritative: it may only move according to S-0010 evidence and can never become reusable merely because operational state was reconciled. Any unresolved/unknown grant remains fail-closed.

Cancellation transition rules:

- `cancel?(receipt)` may request cancellation only for the exact durable receipt; it does not itself mutate state to `CANCELLED`.
- Confirmed provider cancellation for the exact receipt yields normalized `AGENT_CANCELLED` and terminal `CANCELLED`.
- Provider rejection of cancellation leaves the attempt in its prior nonterminal state unless independent provider status proves another terminal outcome.
- Timeout/response loss/ambiguous cancellation result yields `UNKNOWN` when the actual external job state cannot be proven.
- A later completion/failure after already confirmed terminal `CANCELLED` is conflicting post-terminal evidence and cannot trigger continuation; it requires fail-closed reconciliation if the conflict is material.

Ordering rules:

- If adapter provides a trusted monotonic `provider_sequence`, a lower sequence than the last accepted attempt event is stale/no-op; equal sequence with different canonical payload is conflict/fail closed.
- If no trusted sequence exists, a distinct terminal event MUST be reconciled against current provider/external-job status or other provider-supported authoritative read-back before autonomous continuation.
- `occurred_at` alone is never treated as a trusted total ordering signal.
- Any older, conflicting or post-terminal distinct event is no-op or BLOCKED according to whether conflict can affect correctness; it never mutates a proven terminal state or creates a second continuation.
- An `UNKNOWN` attempt may change state only through the authoritative reconciliation exception defined above, never by ordinary event ordering.

### 5.4 Destination contract for every side effect

A single continuation checkpoint or owner lock does **not** make an external side effect at-most-once. Every effect, including evidence persistence and an initial adapter dispatch under Section 8, MUST follow this section. Resuming a checkpoint means inspecting its durable effect records, not blindly repeating the next step.

Before the first effect, trusted Genesis MUST persist an effect record with immutable identity/request bindings and a monotonic outcome log: stable `operation_id`; owning checkpoint identity (or initial `attempt_id` for initial dispatch); logical step/slot; exact task/run/attempt; provider/adapter and destination identity; repository/PR/expected HEAD where applicable; canonical request/payload hash; applicable authority and S-0010 grant tuple; destination-contract GitHub ref/hash; effect class; state; and eventual receipt/read-back evidence. The same logical step/slot has exactly one effect record. For continuation effects it is created atomically with ownership admission/claim of the accepted-event checkpoint; for initial dispatch it is created atomically with the PREPARED attempt and its initial-dispatch admission record, before any accepted-event checkpoint exists. Changed payload, destination or bindings for an existing slot is a conflict, not permission to generate another operation. Multi-effect continuations require a separate durable record per ordered effect; completion requires all required effect outcomes, and recovery never repeats already completed effects.

The operation identity is assigned once by trusted Genesis before dispatch and reused across crash, callback redelivery, controller reconstruction and transport retry. It MUST NOT be regenerated from a new session/replay/run/key. Its immutable mapping binds the exact owning checkpoint/attempt and logical slot to the full request and authority tuple; a caller cannot choose a new identity to bypass that mapping.

Each adapter MUST have a versioned, trusted GitHub destination-capability declaration for **each effect path**. It is separate from the closed ProviderDescriptor hash schema, is pinned by ref/hash in the effect record and dispatch evidence, and is verified before dispatch/recovery. It names the exact endpoint/destination, effect semantics, identity binding, retention/finality limits, allowed read-back, and one of the following classes. Runtime self-description cannot upgrade a class; absent or unverified guarantees mean class C, never A/B.

| Class | Required destination guarantee | Recovery after possible effect and before completion |
|---|---|---|
| A — IDEMPOTENT_DESTINATION | Destination atomically binds the stable operation identity to the exact payload and accepts its logical effect at most once, including concurrent requests. Same identity/same payload is a no-op or returns the same verifiable result; changed payload is rejected. Declaration proves key scope and retention covers all permitted recovery. | Read-back first; an indeterminate episode permits only read-only reconciliation. A later same-key submission needs a final NO_EFFECT episode plus the admission rules below, proven destination protection and independently valid authority/retry budget. Never substitute a new key, endpoint or provider. |
| B — TRANSACTIONAL_EFFECT | The actual effect and its durable completion receipt/checkpoint transition commit in one atomic transaction within the same transaction domain. | Read the authoritative transaction result: committed is no-op; proven aborted is recorded as episode NO_EFFECT, and a later transaction requires a newly admitted episode under still-valid authority. Separate external HTTP calls plus local Durable Object writes are **not** one transaction. |
| C — NON_IDEMPOTENT_NON_TRANSACTIONAL | Neither A nor B is proven. | Any possible dispatch without authoritative final outcome becomes `INDETERMINATE_EFFECT` / operational `UNKNOWN`. Automatic replay is forbidden; only read-only reconciliation is allowed. |

One logical effect has immutable identity/request bindings and an append-only sequence of numbered **dispatch episodes**, starting at 1. Each episode records `episode_no`, admission identity, owner/fencing epoch, state and authoritative outcome evidence. Episode lifecycle is `PLANNED → DISPATCHING → SUCCEEDED|NO_EFFECT|UNKNOWN`. Proven exclusion of every sender before dispatch may also close `PLANNED → NO_EFFECT`. `SUCCEEDED` and `NO_EFFECT` terminate **that episode**, never erase history. Only authoritative read-only reconciliation may resolve an episode `UNKNOWN → SUCCEEDED|NO_EFFECT`, recording the prior uncertainty and resolution evidence without overwriting history. A/C ambiguity permits no transport resubmission until that resolution proves NO_EFFECT.

The aggregate effect state is derived, not a separately writable linear lifecycle: no admitted episode means PLANNED; any SUCCEEDED episode means COMPLETED permanently; otherwise an unresolved UNKNOWN episode means INDETERMINATE_EFFECT; otherwise the latest PLANNED/DISPATCHING episode means IN_PROGRESS; otherwise the last final NO_EFFECT episode means NO_EFFECT. There is at most one nonterminal episode; a new admission requires the preceding episode's final NO_EFFECT. No episode may follow SUCCEEDED or UNKNOWN. A next numbered episode may follow final NO_EFFECT only by the atomic retry admission below; aggregate NO_EFFECT then becomes IN_PROGRESS without changing the previous episode's terminal state. Missing/contradictory history fails closed.

For A/C, durable episode DISPATCHING is committed **before** entering the external call; only its admitted owner may send once in that episode. Crash with DISPATCHING is possible-effect evidence even if the crash might have preceded the actual call: recover it as UNKNOWN before any continuation. For B, the actual effect and episode SUCCEEDED plus its completion receipt/checkpoint transition commit atomically; abort leaves no partial external effect. A local transaction surrounding an HTTP call does not qualify.

Initial dispatch uses a durable **initial-dispatch admission record**, not a future accepted-event checkpoint. Creation atomically binds PREPARED attempt + its immutable initial-effect record + episode 1 + unclaimed ownership epoch in the same authoritative runtime store. A compare-and-set claim binds one owner/epoch to that exact task/run/attempt/request/authority tuple. For S-0010, admission must also verify/reserve the exact grant atomically with these technical execution bindings before allowing the episode's DISPATCHING transition. If PREPARED creation precedes grant reservation, the initial admission remains non-dispatchable until that identity-bound reservation commits. Missing/mismatched records, failed reservation or partial writes block dispatch and require reconciliation. Recovery uses the same admission/effect/episode record and never creates a replacement first-dispatch owner merely because no continuation checkpoint exists.

Both initial-dispatch admission claims and checkpoint recovery claims require atomic compare-and-set ownership and fencing against the former owner. A lease expiry, timeout or new controller alone cannot prove the old dispatch stopped. In particular, class C never starts another call while an earlier sender/request may still act. A/B rely on their proven destination/transaction boundary as well as ownership; without that boundary they are treated as C.

Read-only reconciliation for the exact operation may record:

- `EFFECT_CONFIRMED`: authoritative destination receipt proves the exact immutable bindings/result; record the exact episode SUCCEEDED and derive aggregate COMPLETED without invoking it again.
- `NO_EFFECT`: record that episode's final NO_EFFECT only when authoritative final evidence proves neither an accepted effect nor any in-flight/queued/old-owner request can still produce it. An empty search, temporary 404, missing local receipt, duplicate rejection, timeout or expired lease is insufficient.
- unknown/conflicting outcome: retain episode UNKNOWN / aggregate INDETERMINATE_EFFECT and the owning admission/checkpoint's UNKNOWN quarantine; no success, replay, automatic expiry or new identity.

For every class, proven episode `NO_EFFECT` is necessary but not sufficient for a later dispatch: applicable explicit retry/authority policy, remaining budgets, fresh GitHub task/HEAD checks and effective exclusion of the former sender are also mandatory. A later admitted retry atomically compares the last episode number and final NO_EFFECT proof, verifies former-owner exclusion and current authority/budgets, and appends exactly the next numbered PLANNED episode to the same effect under one owner/fencing epoch. It records DISPATCHING before any send; concurrent retries cannot admit two episodes; reconciliation itself performs no external mutation. For S-0010, stricter one-consumption and retries=0 always win: no second model request under the grant, even if a destination supports idempotency or proves no effect. Closed/consumed/unknown grants are never reset; any genuinely new model request needs a new canonical CEO issuance and separately admitted attempt.

For every supported path, the adapter declaration MUST classify GitHub Draft PR creation, comment creation, review-request/comment creation, model/API invocation, paid invocation, provider-job submission, evidence persistence and any other consequential/future continuation write. GitHub create/comment/review endpoints and model/job APIs default to C unless their exact destination contract proves A or B. A marker in a comment, client-side dedupe, a duplicate HTTP error, or a local transaction around an HTTP call is not destination idempotency. An intermediary counts as A only if its guarantee covers the final external effect across its own crashes.

Failure/ambiguity during read-back or duplicate rejection never becomes success by inference. Recovered successful effects may be retained as historical evidence, but every resumed continuation and every positive review-gate use MUST reverify current GitHub task/PR/HEAD and authority. Stale/revoked state blocks continuation/gate use without undoing the historical effect or rerunning it. These requirements preserve safety by stopping in class C; they do not promise eventual completion for every crashed external operation.

## 6. Independent review result compatibility

`REVIEW_COMPLETED` is transport completion only. Consequential use requires a validated result compatible with the canonical S-0009/S-0010 contract.

```json
{
  "reviewer_provider_id": "string",
  "reviewer_adapter_id": "string",
  "artifact_producer": {
    "provider_id": "string|null",
    "adapter_id": "string|null",
    "independence_class": "string",
    "trusted_producer_ref": "github/evidence reference"
  },
  "verdict": "APPROVE|APPROVE_WITH_FINDINGS|REQUEST_CHANGES|BLOCKED",
  "expected_head_sha": "40-char sha",
  "reviewed_head_sha": "40-char sha",
  "acceptance_head_sha": "40-char sha",
  "head_confirmed": "YES|NO",
  "repository_state": "CLEAN|NOT_CLEAN",
  "findings": [],
  "ready_gate_safe": "YES|NO",
  "grant_id": "string|null",
  "manifest_hash": "64-char lowercase sha256|null",
  "issuance_digest": "64-char lowercase sha256|null",
  "durable_evidence_ref": "github:comment-or-review-id"
}
```

Rules:

- Canonical verdict and repository-state vocabularies are exactly S-0009 values; S-0011 introduces no lossy synonyms such as `CHANGES_REQUIRED`, `DIRTY` or `UNKNOWN` at this boundary.
- Existing S-0009 closed-schema/cross-field invariants remain authoritative.
- Expected, reviewed and acceptance HEAD must match for positive gate evidence.
- S-0010 path requires canonical `grant_id + manifest_hash + issuance_digest` and one-consumption lifecycle.
- `durable_evidence_ref` must be trusted-write + GitHub read-back verified before gate use.
- Producer independence is checked against trusted artifact-producer identity, never caller prose.
- Valid result is evidence only; it grants no next consequential action.

## 7. TaskRequirements and deterministic Adaptive Router

### 7.1 TaskRequirements

```json
{
  "task_id": "string",
  "run_id": "string",
  "required_capabilities": ["string"],
  "required_role": "string",
  "required_independence_class": "string|null",
  "artifact_producer": {
    "provider_id": "string|null",
    "adapter_id": "string|null",
    "independence_class": "string|null",
    "trusted_producer_ref": "string|null"
  },
  "allowed_permissions": ["read_only", "bounded_write"],
  "budget": {
    "paid_allowed": false,
    "currency": "ISO-4217|null",
    "max_cost_minor_units": "integer|null"
  },
  "authority": {
    "required": true,
    "authority_type": "review_grant|execution_authorization|read_only_policy|other",
    "canonical_ref": "github:...|null",
    "grant_id": "string|null",
    "manifest_hash": "sha256|null",
    "issuance_digest": "sha256|null",
    "authorized_actions": ["string"],
    "verified_state": "VERIFIED|UNVERIFIED|NOT_REQUIRED"
  },
  "criticality": "low|normal|high|consequential",
  "allowed_providers": ["string"]
}
```

TaskRequirements is not authority itself. Trusted Genesis derives security-sensitive fields from canonical GitHub/governance evidence. For independent review, trusted producer identity is mandatory. For S-0010 review, complete canonical grant tuple and exact authorization conditions are mandatory; provider selection never substitutes grant admission/reservation.

### 7.2 Hard filters

Reject a candidate when any applies:

1. required capability/role absent;
2. trusted descriptor provenance invalid/stale for security-sensitive use;
3. independence requirement violated or producer identity cannot be proven;
4. provider not allowed by policy;
5. availability `UNAVAILABLE`, invokable `NO`, quota exhausted, active rate limit, credential readiness `NO`;
6. permissions exceed task authority;
7. required authority missing/unverified or requested action not authorized;
8. metered provider while paid forbidden;
9. metered cost/currency unknown, malformed, incompatible or above cap;
10. fallback would change a governance-required identity/independence class;
11. any unknown security-sensitive state that could alter authority, money, independence or consequential correctness.

### 7.3 Deterministic ranking

Ranking policy is versioned canonical GitHub material identified by `policy_ref + policy_hash`. The policy MUST explicitly name every ranking dimension, trusted input source, direction, unknown handling and stable weight/priority. A dimension not present in the canonical descriptor/snapshot/policy evidence is not silently inferred.

v0.1 permitted normalized ranking inputs are only those with defined evidence sources, e.g.:

- `resource_headroom`: from proven quota state/remaining where comparable; otherwise policy-defined UNKNOWN rank;
- `cost`: from proven compatible minor-unit estimate; free has policy-defined value;
- `latency`: from current non-stale `latency_ms` evidence or policy-defined UNKNOWN rank;
- `availability/stability`: from ResourceSnapshot states, not invented historical quality;
- any `quality` or `confidence` dimension is forbidden unless a later canonical policy defines its numeric source/provenance and normalization.

After policy score/priority comparison, total-order tie-break is always ascending canonical tuple `(provider_id, adapter_id, model_id-or-empty)` using UTF-8 lexicographic comparison. Registry iteration/input order MUST NOT affect selection.

Router returns `SELECTED` or explicit `BLOCKED`, recording policy ref/hash, provider/adapter, reasons, rejected candidates and complete applicable authority identity including `grant_id`, `manifest_hash`, `issuance_digest` when S-0010 applies.

## 8. Adapter, InvocationEnvelope and InvocationReceipt

Required logical interface:

```text
describe()           -> RuntimeDescriptorObservation
observe()            -> ResourceSnapshot
canInvoke(envelope)  -> admissibility detail
invoke(envelope)     -> InvocationReceipt | UNKNOWN
poll?(receipt)       -> NormalizedAgentEvent
reconcile?(attempt)  -> read-only reconciliation result
cancel?(receipt)     -> normalized cancellation request/result observation
normalizeEvent(raw)  -> NormalizedAgentEvent
```

Adapter never chooses governance/budget policy and never expands authority.

### 8.1 InvocationEnvelope

```json
{
  "task_id": "string",
  "run_id": "string",
  "attempt_id": "globally-unique-string",
  "provider_id": "string",
  "adapter_id": "string",
  "request_hash": "sha256",
  "routing_policy_ref": "string",
  "authority_ref": "string|null",
  "grant_id": "string|null",
  "manifest_hash": "sha256|null",
  "issuance_digest": "sha256|null",
  "artifact_producer_ref": "string|null",
  "repository": "owner/repo|null",
  "pr_number": "number|null",
  "expected_head_sha": "40-char sha|null",
  "authorized_actions": ["string"]
}
```

### 8.2 InvocationReceipt

```json
{
  "task_id": "string",
  "run_id": "string",
  "attempt_id": "string",
  "provider_id": "string",
  "adapter_id": "string",
  "request_hash": "sha256",
  "authority_ref": "string|null",
  "grant_id": "string|null",
  "manifest_hash": "sha256|null",
  "issuance_digest": "sha256|null",
  "dispatch_state": "PREPARED|DISPATCH_CONFIRMED|UNKNOWN|COMPLETED|FAILED|CANCELLED|FAILED_NO_DISPATCH",
  "external_job_id": "string|null",
  "reconciliation_key": "non-secret-string|null",
  "prepared_at": "RFC3339",
  "dispatched_at": "RFC3339|null",
  "updated_at": "RFC3339"
}
```

For S-0010-bound work, `grant_id + manifest_hash + issuance_digest` MUST match the verified TaskRequirements tuple through routing decision, envelope, durable receipt, dispatch admission, reconciliation and review evidence. Any mismatch blocks dispatch/recovery and cannot mint/release authority.

Write ordering and S-0010 grant terminalization:

1. Atomically persist the exact `PREPARED` attempt with task/run/provider/adapter/request/authority tuple, initial-dispatch admission record, initial-effect record and episode 1 as required by Section 5.4 before external dispatch. If provider supports a caller-generated stable non-secret idempotency/correlation identity, persist it in this PREPARED record before dispatch.
2. For S-0010-bound reviewer work, atomically reserve the exact canonical grant as `RESERVED` for this exact durable `attempt_id` and receipt identity before model dispatch. Generic orchestration may not skip or collapse this reservation.
3. Dispatch only the exact persisted `PREPARED` attempt bound to that `RESERVED` grant, after Section 5.4 effect admission for its initial-dispatch slot. A second controller cannot dispatch the reserved attempt merely because completion is missing.
4. Once dispatch occurrence is proven, atomically transition the authoritative grant ledger for that exact attempt from `RESERVED` to `CONSUMED`, then persist/confirm `DISPATCH_CONFIRMED` with stable external/reconciliation identity before reporting success upstream. A successful reviewer invocation may never remain merely `RESERVED`. If a provider callback races this persistence, Section 5.2 requires quarantine/pending handling and forbids committing accepted dedupe state until exact receipt correlation succeeds.
5. If deterministic evidence proves failure occurred before any external dispatch, atomically close the bound grant as `CLOSED_NO_CALL` **and** transition the same durable attempt/receipt from `PREPARED` to terminal `FAILED_NO_DISPATCH` in the same identity-bound operation; only this state is eligible for any later retry/fallback evaluation under the canonical policy. A later retry/fallback requires a new attempt and any authority required by the canonical policy; `CLOSED_NO_CALL` itself is never silently reused.
6. If crash/timeout/response loss makes dispatch occurrence indeterminate, atomically record the bound grant lifecycle as `UNKNOWN` (or preserve the canonical S-0010 unknown-equivalent state) and the receipt/attempt as quarantined `UNKNOWN`; no automatic second paid/consequential/non-idempotent invoke is allowed.
7. A confirmed cancellation after dispatch marks only the operational receipt/attempt `CANCELLED`; it does not reverse the already consumed grant. A cancellation proven before any external dispatch may use `CLOSED_NO_CALL` only when canonical evidence separately proves no dispatch occurred, in which case the attempt is `FAILED_NO_DISPATCH`, not `CANCELLED`.
8. Grant transition and receipt/attempt transition MUST be bound to the same `task_id + run_id + attempt_id + grant_id + manifest_hash + issuance_digest + request_hash`. Any mismatch or partial write is fail-closed and requires read-only reconciliation.
9. Reconciliation is read-only with respect to the external provider and may resolve operational `UNKNOWN` only from provider-supported authoritative evidence plus canonical grant evidence. The resolution must be recorded durably for the same attempt identity before any continuation. Reconciliation cannot mint a new grant, silently reset a consumed/closed/unknown grant, or create a second continuation.
10. UNKNOWN is never TTL-cleared into reusable authority.

## 9. Event-first continuation and fallback

Preferred path:

```text
trusted source verification
→ normalizeEvent
→ canonical key/hash calculation
→ existing accepted-dedupe conflict/replay check
→ exact receipt correlation (or bounded pending quarantine if receipt identity is not yet durable)
→ monotonic attempt-state admission
→ atomic accepted-dedupe + attempt-state transition + durable continuation checkpoint(PENDING)
→ atomic checkpoint claim + per-effect recovery under Section 5.4
→ current GitHub task/PR/HEAD verification
→ result-specific validation
→ trusted evidence read-back
→ admitted effect under verified A/B/C contract OR explicit no-next-step/block
→ verified effect receipt/read-back OR indeterminate-effect quarantine
→ durable continuation checkpoint COMPLETED|BLOCKED|UNKNOWN
```

A replay of an accepted event MUST inspect its checkpoint and effect records. `PENDING`/`IN_PROGRESS` recovers the same exact continuation under Section 5.4; `COMPLETED` is a no-op; `UNKNOWN` permits only read-only reconciliation; `BLOCKED` remains fail-closed unless an applicable policy explicitly permits reevaluation. Reconstruction scans incomplete checkpoints without requiring provider redelivery, but scanning never authorizes repeating an external effect.

Before autonomous continuation require all applicable:

- trusted source namespace;
- exact task/run/attempt;
- terminal event external identity equals durable receipt where provider supplies it;
- event's dedupe key/hash is durably accepted only after correlation/admission, so an early callback cannot be lost as a false replay;
- accepted event has exactly one durable continuation checkpoint, and each side effect has a stable operation record plus verified A/B boundary or C fail-closed handling;
- monotonic/non-regressing attempt state, with `UNKNOWN` resolvable only by authoritative read-only reconciliation;
- current GitHub task state and exact HEAD for HEAD-bound result;
- next step still covered by authority;
- review result satisfies Section 6 and S-0009/S-0010.

Fallback is allowed only to candidates passing the **same** TaskRequirements/governance envelope. It may not auto-charge, increase permissions, change required independence semantics, reuse consumed/closed/unknown grants, or route around unknown governance state. Every fallback creates a new routing decision preserving prior failure/resource evidence.

## 10. Recovery invariants

1. No successful invocation without durable `DISPATCH_CONFIRMED` or equivalent provider-proven external identity.
2. PREPARED after crash requires reconciliation unless non-dispatch is provable; proven non-dispatch closes the exact attempt as `FAILED_NO_DISPATCH` together with applicable `CLOSED_NO_CALL` grant state.
3. UNKNOWN forbids autonomous continuation/repeat where duplicate side effects/model spend are possible; only exact-attempt authoritative read-only reconciliation may resolve the operational outcome.
4. Resolving operational UNKNOWN never restores/mints reusable S-0010 grant authority and never creates a second continuation.
5. Duplicate accepted events reuse one checkpoint: completed checkpoint = no-op; incomplete checkpoint = inspect effect records and recover only under Section 5.4. An early uncorrelated terminal callback is not marked accepted and remains processable after receipt correlation becomes available.
6. Accepted dedupe + attempt transition + continuation checkpoint creation are atomic. Effect admission precedes dispatch; transactional effects commit with their completion. Crash retains recoverable state without requiring redelivery, but possible class C effects remain UNKNOWN until authoritative read-only reconciliation; automatic progress is not guaranteed.
7. Distinct reordered/post-terminal events cannot regress a proven terminal state.
8. Confirmed `CANCELLED` is terminal operational state; ambiguous cancellation is `UNKNOWN`; neither state restores consumed authority.
9. Recovery restores project truth from GitHub and operational attempt/dedupe/pending-delivery/continuation-checkpoint state only from allowed runtime store.
10. Stale task/run/attempt/PR/HEAD evidence never advances workflow; resumed checkpoints re-read these bindings before acting.
11. Retry/fallback is bounded/versioned, never infinite.
12. S-0010 lifecycle remains stricter where applicable and is never weakened by generic orchestration.

## 11. Implementation slices

After current Revision 3 approval, an approved Decision Record covering this new orchestration component, and a separate bounded EA:

### Slice A — trusted pure contracts/router

- canonical registry descriptor/hash validation;
- resource snapshot + budget normalization;
- TaskRequirements/authority/producer validation;
- hard filters + deterministic ranking + total tie-break;
- routing decision evidence;
- no network/runtime mutation.

### Slice B — event/recovery contracts

- normalized event + trusted namespace;
- canonical event hash/dedupe with race-safe acceptance;
- exact receipt correlation;
- monotonic attempt state including `FAILED_NO_DISPATCH`, confirmed cancellation and authoritative UNKNOWN reconciliation;
- accepted-event continuation checkpoints, per-effect identity/ownership and A/B/C destination contracts with fail-closed crash recovery;
- InvocationEnvelope/Receipt + full S-0010 grant tuple;
- bounded polling/read-only reconciliation.

### Slice C — first real adapters

At least two distinct adapters must pass the same contract tests. Independent-review adapter must reuse S-0009/S-0010, not replace them.

### Slice D — controlled One-Window trial

One bounded flow: CEO goal → trusted task/authority → auto selection → durable one-attempt dispatch → completion → validation → one autonomous already-authorized non-consequential next step → CEO summary/gate. No auto-merge/deploy/LIVE.

## 12. Required test matrix

### Registry/hash

- descriptor hash excludes `descriptor_hash` itself;
- fixed canonical descriptor hash vector;
- key/set permutation gives same descriptor hash;
- duplicate/unknown/additional security fields rejected;
- alias cannot replace identity or self-elevate role/permissions.

### Resource/budget/router

- UNKNOWN values are never guessed;
- metered unknown/incompatible/over-cap cost blocked;
- missing/unverified authority or producer identity blocked;
- self-review and independence mismatch blocked;
- ranking uses only canonical evidenced dimensions;
- equal-score candidates produce same selection under every input permutation via stable `(provider_id,adapter_id,model_id)` tie-break.

### Events/correlation/ordering

- fixed canonical event hash vector;
- semantically equal event key-order variants dedupe identically;
- same local event id across different providers does not collide; LF/CR/control injection and malformed Unicode in any dedupe identity component are rejected before lookup, while accepted identities preserve exact UTF-8 bytes;
- same accepted dedupe key/different payload conflicts;
- terminal event missing attempt/correlation required by receipt blocks;
- terminal event for wrong attempt/external job blocks;
- early terminal callback before external identity persistence is pending/not accepted, then can be accepted after receipt correlation is durable;
- stale HEAD blocks continuation;
- distinct STARTED/WAITING/FAILED/COMPLETED/CANCELLED events delivered in relevant reorderings cannot regress/switch proven terminal state;
- cancellation request alone cannot produce CANCELLED; confirmed exact-receipt cancellation can; ambiguous cancellation becomes UNKNOWN;
- operational UNKNOWN cannot continue autonomously, but authoritative exact-attempt reconciliation may resolve it exactly once without restoring reusable grant authority;
- `PREPARED → FAILED_NO_DISPATCH` is terminal and atomically paired with applicable `CLOSED_NO_CALL` grant transition;
- post-terminal events cannot trigger second continuation;
- provider sequence regression/no-sequence reconciliation paths tested.

### Continuation crash/replay

- atomic event acceptance creates exactly one continuation checkpoint bound to exact dedupe key/hash + task/run/attempt;
- crash immediately after accepted-state/checkpoint commit resumes the same checkpoint after reconstruction;
- crash after GitHub/HEAD validation, result validation, evidence persistence, and immediately before/after next-step durable completion is covered by fixed tests;
- replay while checkpoint `PENDING` or `IN_PROGRESS` inspects the same effect records; safe recovery joins the same work while possible class C effects become UNKNOWN;
- replay after checkpoint `COMPLETED` is no-op;
- recovery scans incomplete checkpoints even with no provider redelivery;
- resumed checkpoint re-reads current GitHub/HEAD/authority and blocks stale/revoked continuation;
- concurrent replays cannot obtain two continuation claims; former-owner fencing is tested, including a delayed old sender after lease expiry;
- initial dispatch without an accepted-event checkpoint uses atomic PREPARED + initial admission + effect + episode creation, with exactly one CAS owner; missing/partial/mismatched bindings block; S-0010 grant reservation is verified before DISPATCHING;
- episode NO_EFFECT ends only that episode; separately authorized retry appends exactly episode n+1, keeps episode n immutable, and derives aggregate IN_PROGRESS; concurrent retry admissions have one winner;
- episode UNKNOWN cannot append another episode; final read-only reconciliation resolves it once with durable evidence; SUCCEEDED permanently closes the logical effect and no later episode is possible;
- class A: concurrent same-key/same-payload requests have one logical effect; changed payload, expired key retention, different destination and duplicate rejection without read-back cannot silently succeed or create a replacement key;
- class B: crash before commit proves no effect; crash after commit leaves effect and completion together; an external HTTP call cannot qualify as the same transaction;
- class C: crash before external call but after DISPATCHING, crash after effect/before completion, accepted request with lost reply, and cancellation race all forbid automatic resend until authoritative final reconciliation;
- class C NO_EFFECT proof excludes queued/in-flight/former-owner effects; empty search, temporary 404, duplicate error and timeout remain UNKNOWN;
- GitHub Draft PR/comment/review request, model/API/paid invocation, provider job and evidence writes each have a tested trusted destination declaration; unsupported guarantees default to C;
- one completed effect followed by another ambiguous effect never repeats the first; changing logical slot payload/identity fails closed;
- S-0010 retries=0 forbids a second model request even with class A support or NO_EFFECT evidence; grant state is never reset;
- stale/revoked bindings block recovered continuation and positive review-gate use while preserving historical effect evidence.

### Review compatibility

- canonical `REQUEST_CHANGES` accepted; undefined synonym rejected;
- canonical `CLEAN|NOT_CLEAN` accepted according to S-0009 invariants;
- REVIEW_COMPLETED alone is never gate evidence;
- expected/reviewed/acceptance HEAD mismatch is not gate safe;
- producer independence + trusted GitHub evidence read-back enforced.

### Grant/recovery

- full `grant_id + manifest_hash + issuance_digest` preserved from TaskRequirements through receipt/evidence;
- any tuple-member mismatch after reconstruction fails closed;
- S-0010 grant is `RESERVED` before reviewer dispatch and is terminalized for the same attempt as `CONSUMED`, `CLOSED_NO_CALL`, or `UNKNOWN` according to proven dispatch outcome;
- a successful dispatch cannot remain in `RESERVED`;
- proven pre-dispatch failure atomically records attempt/receipt `FAILED_NO_DISPATCH` with grant `CLOSED_NO_CALL` for the same identity;
- confirmed post-dispatch cancellation leaves the canonical grant consumed while terminalizing only the operational attempt as CANCELLED;
- ambiguous cancellation/dispatch state becomes operational UNKNOWN; later authoritative reconciliation may resolve only the operational outcome and never silently re-enable the grant;
- grant/receipt partial-write or identity mismatch fails closed into reconciliation, never a second dispatch;
- PREPARED before dispatch and DISPATCH_CONFIRMED before upstream success;
- callback racing DISPATCH_CONFIRMED identity persistence cannot be lost through premature accepted-dedupe marking;
- crash/response loss can become UNKNOWN but never silent second consequential dispatch;
- S-0010 one-consumption semantics preserved.

## 13. Acceptance criteria

Implementation is proven only if:

1. Core selection has no provider-name routing branches.
2. New provider can be added by canonical descriptor + adapter without core algorithm change.
3. Descriptor security fields and hashes have trusted versioned GitHub provenance.
4. Unknown resource/authority/cost facts are not guessed.
5. Metered invocation requires proven compatible cost within approved budget.
6. Router is deterministic and explainable under candidate permutations.
7. At least two distinct adapters pass the same contracts.
8. One completion can advance one already-authorized workflow step without manual CEO `проверь`.
9. Event dedupe, race-safe acceptance, exact receipt correlation, monotonic attempt state and checkpoints preserve accepted work; Section 5.4 destination contracts prevent duplicate effects and explicitly quarantine cases where safe automatic continuation cannot be proven.
10. Crash/reconstruction tests prove no silent second consequential/paid dispatch and no silent loss of accepted checkpoint state; class C may remain blocked instead of automatically completing. Authoritative UNKNOWN reconciliation cannot restore reusable grant authority.
11. Independent-review routing prevents self-review from trusted producer identity.
12. S-0009/S-0010 canonical enum/grant/exact-HEAD/durable-evidence rules remain intact.
13. GitHub remains project SoT.
14. Full affected test suite is green and independent review binds exact PR HEAD.
15. Ready/merge/deploy/LIVE remain separate CEO gates.
16. An approved Decision Record exists before any Slice A/B implementation begins and covers the adaptive router, normalized event processing, durable attempt/recovery state, trust boundaries, and relationship to the existing Broker architecture.
17. Cancellation is provider-neutral and deterministic: confirmed exact-receipt cancellation maps to `AGENT_CANCELLED`/`CANCELLED`, ambiguity maps to `UNKNOWN`, and cancellation never restores consumed authority.
18. Proven no-dispatch failure has an explicit terminal `FAILED_NO_DISPATCH` attempt/receipt state paired with canonical no-call grant handling.
19. At-most-once effects are established only through a verified destination idempotency contract (A), an atomic effect/completion transaction (B), or fail-closed class C handling with no automatic replay after indeterminate dispatch. Each supported effect path declares its class and passes the Section 12 crash/concurrency tests; a checkpoint alone proves neither destination idempotency nor runtime correctness.

## 14. Non-goals

- no new large control plane or second project SoT;
- no vector DB merely for routing;
- no automatic credit purchase/top-up or currency conversion;
- no standing authority for any provider;
- no S-0009/S-0010 replacement or DR-0008 lift;
- no Dify dependency requirement;
- no auto-merge/deploy/LIVE.

## 15. Implementation allowlist after approval

A separate EA must set the exact allowlist. Recommended maximum Slice A/B boundary:

- `services/genesis-broker/src/agent-*`
- `services/genesis-broker/src/adaptive-router.js`
- `services/genesis-broker/tests/agent-*.test.js`
- `services/genesis-broker/tests/adaptive-router.test.js`
- `docs/genesis-broker/agent-orchestration.md`
- `bridge/QUEUE.md` / `bridge/HANDOFF.md` only if EA explicitly requires task-state sync.

Production route wiring, Durable Object migration, webhook deployment, secrets/config, Cloudflare deployment and provider LIVE calls remain separate stages/gates.

## 16. Decision Record boundary

An **approved Decision Record is mandatory before any Slice A/B implementation begins**. This is a governance prerequisite independent of whether the code lives inside the existing Broker service. The DR must cover at minimum: the adaptive router as a new orchestration component, normalized event processing, durable attempt/dedupe/recovery/continuation-checkpoint state, trust boundaries and canonical GitHub provenance, S-0009/S-0010 grant integration, per-effect identity, destination idempotency/transaction boundaries, non-idempotent UNKNOWN semantics, failure/reconciliation/cancellation semantics, and the relationship to the existing Broker architecture. S-0011 approval alone and any later implementation EA do not waive this prerequisite.

If implementation later introduces a new project/control-plane SoT, credential trust boundary, standing/chained consequential authority, automatic paid-spend policy, privileged provider authority, or materially new production event infrastructure that changes governance guarantees, the Decision Record must be revised/extended and approved before that expanded implementation.

## 17. Revision 2 review and approval

Historical Revision 2 CEO approval was recorded on 2026-09-11 for exact HEAD `81c8859d29adc666e5ac0c1d957dd83f8e3daadb`. It is not current clean-review evidence: fresh Qodo review of the approval-sync HEAD `99bdcfb08420a626499a621e03b351d7a05832ec` confirmed the external-effect replay finding (1 bug / 0 rule violations; PR #122 comment #5632980920). Revision 3 requires its own completed exact-HEAD review and separate CEO Approval; neither is inherited. This approval still does not grant implementation EA, Ready, merge, Decision Record creation, deploy/promotion, LIVE, secrets/PAT mutation, Dify, authenticated production Broker calls, production Grok/xAI calls, DR-0008 lift or scope expansion.
