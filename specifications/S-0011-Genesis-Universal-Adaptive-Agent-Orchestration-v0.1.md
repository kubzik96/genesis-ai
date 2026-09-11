# S-0011 — Genesis Universal Adaptive Agent Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0011 |
| Title | Genesis Universal Adaptive Agent Orchestration v0.1 |
| Status | **In Review** |
| Revision | 2 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date (GitHub UTC) | 2026-09-10 |
| Revision 1 approval date | 2026-09-11 |
| Revision 1 approved by | CEO Genesis AI |
| Related Issue | #121 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1; S-0010 Revision 2 |
| Related Decisions | DR-0005; DR-0008; DR-0010; DR-0011 |
| Execution Authorization | **NOT_GRANTED — implementation requires separate CEO EA** |

## Revision history

| Revision | Date | Status | Change |
|---|---|---|---|
| 1 | 2026-09-10/11 | Approved | Initial implementation-grade contract; CEO-approved after independent review. |
| 2 | 2026-09-11 | **In Review** | Non-scope-expanding correctness hardening after post-approval exact-HEAD Qodo review: exact attempt correlation, canonical descriptor/event hashing, full S-0010 grant provenance and terminal lifecycle, canonical S-0009 result enums, deterministic routing tie-breaks, monotonic terminal-event semantics, and mandatory approved Decision Record before implementation. Requires fresh independent review and CEO approval before implementation EA. |

Revision 2 does not broaden product scope or grant implementation/runtime authority. Where Revision 2 clarifies a Revision 1 ambiguity, the stricter fail-closed rule in Revision 2 governs.

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
2. Runtime cache/Durable Object/queue may store delivery, dedupe, attempt, dispatch, resource and reconciliation state only; it is not a competing project/governance SoT.
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
  "event_type": "AGENT_SELECTED|AGENT_STARTED|AGENT_WAITING|AGENT_COMPLETED|AGENT_FAILED|REVIEW_STARTED|REVIEW_COMPLETED|LIMIT_EXHAUSTED|RATE_LIMITED|RESET_AT|PROVIDER_UNAVAILABLE",
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

Terminal/dispatch-derived events `AGENT_COMPLETED`, `AGENT_FAILED` and `REVIEW_COMPLETED` MUST have non-null `attempt_id`. If the provider supplies `external_job_id` or `reconciliation_key`, the terminal event must carry the corresponding value and it MUST equal the durable InvocationReceipt before state mutation or continuation. A terminal event without required correlation is BLOCKED. Null `attempt_id` is allowed only for observations that are provably not tied to a dispatched attempt, such as provider-wide quota/rate-limit state.

### 5.2 Canonical event identity and payload hash

Canonical dedupe key:

```text
source_namespace + "\n" + provider_id + "\n" + adapter_id + "\n" + event_id
```

The canonical payload hash excludes no semantic event field except no separately stored hash field exists in the schema. Preimage contains exactly all event schema fields above, in lexicographic key order. Rules:

- JSON object keys lexicographically ordered.
- Strings and `null` encoded as canonical compact JSON values.
- Numeric `provider_sequence` is an integer JSON number only; no floating/exponential equivalent accepted.
- No whitespace outside strings.
- UTF-8 bytes → SHA-256 → lowercase hex.
- Schema rejects additional keys before hashing.

Same canonical dedupe key + same payload hash = replay/no-op. Same key + different hash = conflict/fail closed. Different providers/adapters with equal local `event_id` do not collide. Implementation tests MUST use shared fixed vectors proving key-order-independent normalization of semantically identical events.

### 5.3 Per-attempt monotonic state

Event dedupe alone is insufficient. Core maintains a durable operational state machine per `attempt_id`:

```text
PREPARED
  → DISPATCH_CONFIRMED
  → WAITING
  → COMPLETED | FAILED | UNKNOWN
```

`DISPATCH_CONFIRMED → COMPLETED|FAILED|UNKNOWN` is allowed directly. `WAITING` may repeat as observation without regressing state. `COMPLETED`, `FAILED`, and `UNKNOWN` are terminal/non-regressible for autonomous continuation. A later distinct event cannot reopen or switch a terminal attempt.

Ordering rules:

- If adapter provides a trusted monotonic `provider_sequence`, a lower sequence than the last accepted attempt event is stale/no-op; equal sequence with different canonical payload is conflict/fail closed.
- If no trusted sequence exists, a distinct terminal event MUST be reconciled against current provider/external-job status or other provider-supported authoritative read-back before autonomous continuation.
- `occurred_at` alone is never treated as a trusted total ordering signal.
- Any older, conflicting or post-terminal distinct event is no-op or BLOCKED according to whether conflict can affect correctness; it never mutates terminal state or creates a second continuation.

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
cancel?(receipt)     -> normalized result
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
  "dispatch_state": "PREPARED|DISPATCH_CONFIRMED|UNKNOWN|COMPLETED|FAILED_NO_DISPATCH",
  "external_job_id": "string|null",
  "reconciliation_key": "non-secret-string|null",
  "prepared_at": "RFC3339",
  "dispatched_at": "RFC3339|null",
  "updated_at": "RFC3339"
}
```

For S-0010-bound work, `grant_id + manifest_hash + issuance_digest` MUST match the verified TaskRequirements tuple through routing decision, envelope, durable receipt, dispatch admission, reconciliation and review evidence. Any mismatch blocks dispatch/recovery and cannot mint/release authority.

Write ordering and S-0010 grant terminalization:

1. Persist exact `PREPARED` attempt with task/run/provider/adapter/request/authority tuple before external dispatch.
2. For S-0010-bound reviewer work, atomically reserve the exact canonical grant as `RESERVED` for this exact durable `attempt_id` and receipt identity before model dispatch. Generic orchestration may not skip or collapse this reservation.
3. Dispatch only the exact persisted `PREPARED` attempt bound to that `RESERVED` grant.
4. Once dispatch occurrence is proven, atomically transition the authoritative grant ledger for that exact attempt from `RESERVED` to `CONSUMED`, then persist/confirm `DISPATCH_CONFIRMED` with stable external/reconciliation identity before reporting success upstream. A successful reviewer invocation may never remain merely `RESERVED`.
5. If deterministic evidence proves failure occurred before any external dispatch, atomically close the bound grant as `CLOSED_NO_CALL` and mark the receipt `FAILED_NO_DISPATCH`; only this state is eligible for any later retry/fallback evaluation under the canonical policy.
6. If crash/timeout/response loss makes dispatch occurrence indeterminate, atomically record the bound grant lifecycle as `UNKNOWN` (or preserve the canonical S-0010 unknown-equivalent state) and the receipt as `UNKNOWN`; no automatic second paid/consequential/non-idempotent invoke is allowed.
7. Grant transition and receipt transition MUST be bound to the same `task_id + run_id + attempt_id + grant_id + manifest_hash + issuance_digest + request_hash`. Any mismatch or partial write is fail-closed and requires read-only reconciliation.
8. Reconciliation is read-only and may resolve `UNKNOWN` only from provider-supported evidence plus canonical grant evidence; it cannot mint a new grant or silently reset a consumed/closed/unknown grant.
9. UNKNOWN is never TTL-cleared into reusable authority.

## 9. Event-first continuation and fallback

Preferred path:

```text
trusted source verification
→ normalizeEvent
→ canonical hash + dedupe
→ exact receipt correlation
→ monotonic attempt-state validation
→ current GitHub task/PR/HEAD verification
→ result-specific validation
→ trusted evidence read-back
→ next already-authorized step
```

Before autonomous continuation require all applicable:

- trusted source namespace;
- exact task/run/attempt;
- terminal event external identity equals durable receipt where provider supplies it;
- monotonic/non-regressing attempt state;
- current GitHub task state and exact HEAD for HEAD-bound result;
- next step still covered by authority;
- review result satisfies Section 6 and S-0009/S-0010.

Fallback is allowed only to candidates passing the **same** TaskRequirements/governance envelope. It may not auto-charge, increase permissions, change required independence semantics, reuse consumed/closed/unknown grants, or route around unknown governance state. Every fallback creates a new routing decision preserving prior failure/resource evidence.

## 10. Recovery invariants

1. No successful invocation without durable `DISPATCH_CONFIRMED` or equivalent provider-proven external identity.
2. PREPARED after crash requires reconciliation unless non-dispatch is provable.
3. UNKNOWN forbids automatic repeat where duplicate side effects/model spend are possible.
4. Duplicate events replay safely; distinct reordered/post-terminal events cannot regress terminal state.
5. Recovery restores project truth from GitHub and operational attempt/dedupe state only from allowed runtime store.
6. Stale task/run/attempt/PR/HEAD evidence never advances workflow.
7. Retry/fallback is bounded/versioned, never infinite.
8. S-0010 lifecycle remains stricter where applicable and is never weakened by generic orchestration.

## 11. Implementation slices

After Revision 2 approval, an approved Decision Record covering this new orchestration component, and a separate bounded EA:

### Slice A — trusted pure contracts/router

- canonical registry descriptor/hash validation;
- resource snapshot + budget normalization;
- TaskRequirements/authority/producer validation;
- hard filters + deterministic ranking + total tie-break;
- routing decision evidence;
- no network/runtime mutation.

### Slice B — event/recovery contracts

- normalized event + trusted namespace;
- canonical event hash/dedupe;
- exact receipt correlation;
- monotonic attempt state;
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
- same local event id across different providers does not collide;
- same dedupe key/different payload conflicts;
- terminal event missing attempt/correlation required by receipt blocks;
- terminal event for wrong attempt/external job blocks;
- stale HEAD blocks continuation;
- distinct STARTED/WAITING/FAILED/COMPLETED events delivered in relevant reorderings cannot regress/switch terminal state;
- post-terminal events cannot trigger second continuation;
- provider sequence regression/no-sequence reconciliation paths tested.

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
- grant/receipt partial-write or identity mismatch fails closed into reconciliation, never a second dispatch;
- PREPARED before dispatch and DISPATCH_CONFIRMED before upstream success;
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
9. Event dedupe, exact receipt correlation and monotonic terminal state prevent duplicate/wrong continuation.
10. Crash/reconstruction tests prove no silent second consequential/paid dispatch.
11. Independent-review routing prevents self-review from trusted producer identity.
12. S-0009/S-0010 canonical enum/grant/exact-HEAD/durable-evidence rules remain intact.
13. GitHub remains project SoT.
14. Full affected test suite is green and independent review binds exact PR HEAD.
15. Ready/merge/deploy/LIVE remain separate CEO gates.
16. An approved Decision Record exists before any Slice A/B implementation begins and covers the adaptive router, normalized event processing, durable attempt/recovery state, trust boundaries, and relationship to the existing Broker architecture.

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

An **approved Decision Record is mandatory before any Slice A/B implementation begins**. This is a governance prerequisite independent of whether the code lives inside the existing Broker service. The DR must cover at minimum: the adaptive router as a new orchestration component, normalized event processing, durable attempt/dedupe/recovery state, trust boundaries and canonical GitHub provenance, S-0009/S-0010 grant integration, failure/reconciliation semantics, and the relationship to the existing Broker architecture. S-0011 approval alone and any later implementation EA do not waive this prerequisite.

If implementation later introduces a new project/control-plane SoT, credential trust boundary, standing/chained consequential authority, automatic paid-spend policy, privileged provider authority, or materially new production event infrastructure that changes governance guarantees, the Decision Record must be revised/extended and approved before that expanded implementation.

## 17. Revision 2 review requirement

Independent review must bind the exact current PR HEAD and verify at minimum the seven post-approval findings now addressed plus the two subsequent governance/lifecycle findings: exact receipt correlation, descriptor canonical hash, complete S-0010 grant tuple, canonical S-0009 enum compatibility, canonical event hash, deterministic total routing order, out-of-order/post-terminal event handling, S-0010 grant terminalization, and mandatory Decision Record before implementation. Revision 2 remains **In Review** until that review is clean and CEO separately approves Revision 2. That approval still does not grant implementation EA.