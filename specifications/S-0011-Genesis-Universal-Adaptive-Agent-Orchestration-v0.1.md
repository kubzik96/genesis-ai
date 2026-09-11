# S-0011 — Genesis Universal Adaptive Agent Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0011 |
| Title | Genesis Universal Adaptive Agent Orchestration v0.1 |
| Status | **Approved** |
| Revision | 1 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date (GitHub UTC) | 2026-09-10 |
| Approval date | 2026-09-11 |
| Approved by | CEO Genesis AI |
| Related Issue | #121 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1; S-0010 Revision 2 |
| Related Decisions | DR-0005; DR-0008; DR-0010; DR-0011 |
| Execution Authorization | **NOT_GRANTED — implementation requires separate CEO EA** |

## Revision history

| Revision | Date | Author | Change |
|---|---|---|---|
| 1 | 2026-09-10 | ChatGPT — COO | Initial implementation-grade Draft for Issue #121; hardened after exact-HEAD independent Qodo review to bind authorization, producer identity, registry provenance, budget units, review evidence, event namespace and crash-recovery receipts. CEO approved Revision 1 on 2026-09-11 after clean exact-HEAD Qodo review. |

## 1. Цель

Сделать следующий One-Window слой Genesis provider-neutral: CEO задаёт цель один раз, а Genesis сам определяет требуемую роль, видит доступные adapters/providers, выбирает лучший допустимый путь, запускает исполнителя, узнаёт о завершении/лимите, проверяет результат и продолжает до следующего consequential CEO gate.

Целевой поток:

```text
CEO goal
→ trusted task/authority envelope
→ provider registry
→ resource snapshot
→ hard governance filter
→ adaptive selection
→ durable attempt reservation
→ invoke adapter
→ normalized event
→ exact task/run/PR/HEAD validation
→ result/review validation
→ trusted evidence
→ next already-authorized step or CEO gate
```

S-0011 не делает конкретный бренд архитектурной зависимостью. `Astra`, `Codex`, `Copilot`, `Qodo`, `Grok/xAI`, `Jules` и будущие providers — сменные adapters. `Julius` считается устаревшим/ошибочным алиасом `Jules`, а не отдельным provider.

## 2. Продуктовый результат

После реализации v0.1 CEO не должен вручную:

- проверять, закончил ли агент задачу/review;
- писать «проверь» после каждого внешнего шага;
- помнить, какой provider сейчас исчерпал лимит;
- вручную выбирать fallback, когда допустимый альтернативный provider очевиден;
- переносить одинаковый task/run/PR/HEAD context между adapters;
- разбираться, почему Genesis выбрал конкретного исполнителя.

Genesis должен возвращать короткий результат вида:

```text
ROLE: independent_reviewer
SELECTED: provider-x / adapter-y
WHY: capability match + invokable + within budget + independent
AUTHORITY: verified / reserved / not-required-for-read-only
RESULT: completed / blocked
NEXT: autonomous_step | CEO_GATE_REQUIRED
EVIDENCE: GitHub exact task/run/PR/HEAD + routing/authority reference
```

## 3. Канонические границы

1. GitHub остаётся единственным durable Source of Record для project state, решений, task/evidence и consequential gate evidence.
2. Runtime cache/DO/queue может хранить только оперативное состояние доставки, дедупликации, attempt/dispatch и resource snapshot. Это не второй project SoT.
3. Подключение provider не создаёт ему authority.
4. Событие `COMPLETED` не создаёт Ready/Merge/Deploy/LIVE authority.
5. Платный fallback не допускается без применимой budget/authorization policy.
6. Provider с более широкими permissions не выбирается автоматически, если task authority их не покрывает.
7. Нельзя выдумывать quota, reset, cost, health или availability. Недоказуемое значение = `UNKNOWN`.
8. Security-sensitive registry claims не могут исходить только от самого provider/adapter; они должны быть привязаны к trusted versioned registry authority в GitHub.
9. Reviewer routing не заменяет S-0009/S-0010: canonical CEO grant, one-consumption lifecycle, exact HEAD и trusted review evidence остаются обязательными.
10. DR-0008 сохраняет силу. S-0011 не снимает quarantine и не разрешает production Broker/xAI/Dify/Cloudflare действия.

## 4. Минимальная архитектура v0.1

S-0011 требует четыре небольших слоя. Они должны быть независимыми от конкретных брендов.

### 4.1 Provider Registry

Реестр descriptors/adapters. Каждая запись имеет стабильную security identity и может иметь человекочитаемые aliases.

Минимальный canonical descriptor:

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
  "descriptor_hash": "sha256"
}
```

Требования:

- `provider_id + adapter_id` образуют стабильную identity;
- aliases не меняют security identity;
- `Julius` может быть alias для `Jules`, но не отдельной identity;
- новый provider добавляется descriptor + adapter, без изменения core routing logic;
- duplicate identity, неизвестные capability/role enums и malformed descriptors fail closed;
- security-sensitive поля `roles`, `independence_class`, `permissions_class`, `cost_class` и допустимые invocation modes берутся из canonical registry material, а не доверяются runtime self-description;
- canonical registry material должен быть versioned в GitHub и проходить обычный project governance для изменения security-sensitive claims;
- `descriptor_hash` детерминированно связывает нормализованный descriptor с canonical registry revision;
- runtime adapter `describe()` может сообщать operational details, но обязан совпасть с canonical `provider_id`, `adapter_id`, model/invocation identity и не может повысить себе role/independence/permissions;
- отсутствующая, непроверяемая, stale или конфликтующая registry provenance = provider не допускается для security-sensitive/consequential routing.

### 4.2 Resource Snapshot

Resource Snapshot — проверяемое состояние конкретного provider/adapter в конкретный момент.

Обязательные поля:

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
  "evidence": ["provider/GitHub/runtime reference"]
}
```

Правила:

- numeric остатки записываются только при доказуемом источнике;
- `null` + соответствующий `UNKNOWN` лучше предположения;
- snapshot имеет freshness TTL, задаваемый policy, а не provider adapter;
- stale snapshot не превращается в AVAILABLE автоматически;
- secrets/credential values запрещены; допустимо только `credential_ready`;
- runtime error при чтении ресурса = `UNKNOWN` или `UNAVAILABLE` только если это доказуемо по контракту adapter;
- metered provider без доказуемой совместимой пары `estimated_cost_minor_units + currency` не допускается к paid invocation;
- currency conversion v0.1 запрещён: бюджет и estimate должны иметь одну и ту же currency; будущая конвертация требует отдельного versioned policy/source-of-rate contract.

### 4.3 Normalized Agent Event

Core должен получать события в едином формате независимо от GitHub webhook, provider webhook, callback, job status API или bounded polling.

Минимальный event contract:

```json
{
  "source_namespace": "stable-trusted-source-namespace",
  "event_id": "stable-source-local-event-id",
  "event_type": "AGENT_SELECTED|AGENT_STARTED|AGENT_WAITING|AGENT_COMPLETED|AGENT_FAILED|REVIEW_STARTED|REVIEW_COMPLETED|LIMIT_EXHAUSTED|RATE_LIMITED|RESET_AT|PROVIDER_UNAVAILABLE",
  "provider_id": "string",
  "adapter_id": "string",
  "task_id": "string",
  "run_id": "string",
  "attempt_id": "string|null",
  "repository": "owner/repo|null",
  "pr_number": "number|null",
  "head_sha": "40-char sha|null",
  "occurred_at": "RFC3339",
  "source": "github_webhook|provider_webhook|callback|status_api|polling",
  "evidence_ref": "string|null"
}
```

Canonical dedupe key:

```text
source_namespace + provider_id + adapter_id + event_id
```

Обязательные свойства:

- `source_namespace` определяется trusted adapter configuration, а не произвольным payload field;
- event delivery idempotent по canonical dedupe key + canonical payload hash;
- duplicate same dedupe key + same payload hash = replay/no-op;
- same dedupe key + different payload hash = conflict/fail closed;
- одинаковые source-local `event_id` разных providers/adapters не конфликтуют;
- событие, привязанное к PR, обязано иметь exact 40-char `head_sha` для действий, зависящих от HEAD;
- stale HEAD event нельзя использовать для продолжения consequential workflow;
- event относится только к точному `task_id + run_id` и, если есть, `attempt_id`;
- событие не создаёт authority само по себе;
- polling разрешён только bounded fallback с фиксированным max attempts/window;
- `REVIEW_COMPLETED` означает только transport/job completion. Само событие не является gate-safe review evidence.

#### 4.3.1 Normalized Review Result

Для использования reviewer output в любом consequential decision после `REVIEW_COMPLETED` требуется отдельный validated result contract, совместимый с S-0009/S-0010:

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
  "verdict": "APPROVE|APPROVE_WITH_FINDINGS|CHANGES_REQUIRED|BLOCKED",
  "expected_head_sha": "40-char sha",
  "reviewed_head_sha": "40-char sha",
  "acceptance_head_sha": "40-char sha",
  "head_confirmed": "YES|NO",
  "scope": "CLEAN|DIRTY|UNKNOWN",
  "findings": [],
  "ready_gate_safe": "YES|NO",
  "grant_id": "string|null",
  "manifest_hash": "sha256|null",
  "durable_evidence_ref": "github:comment-or-review-id"
}
```

Правила:

- для S-0010 reviewer path `grant_id` + `manifest_hash` обязательны и должны быть canonical/consumed exactly по S-0010;
- expected, reviewed и acceptance HEAD должны совпасть для positive gate evidence;
- closed verdict/finding cross-field invariants остаются из S-0009/S-0010;
- `durable_evidence_ref` должен быть read-back verified в GitHub до использования результата как gate evidence;
- reviewer producer-independence должна быть проверена против trusted `artifact_producer`, а не caller text;
- generic `REVIEW_COMPLETED` без этого validated result может только перевести transport observation в «готово к validation», но не продвинуть consequential workflow.

### 4.4 Adaptive Router

Router получает `TaskRequirements`, trusted Provider Registry и Resource Snapshots и возвращает deterministic selection decision.

Минимальный `TaskRequirements`:

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
  "latency_preference": "low|normal|irrelevant",
  "criticality": "low|normal|high|consequential",
  "allowed_providers": ["string"]
}
```

`TaskRequirements` не является authority само по себе. Security-sensitive поля должны быть построены trusted Genesis boundary из GitHub/canonical governance evidence. Caller/provider не может сам объявить себе `VERIFIED`, independence или permissions.

Для independent review `artifact_producer.trusted_producer_ref` обязателен. Если producer identity/independence cannot be verified, independent reviewer routing = BLOCKED.

Для S-0010 reviewer operation `authority_type=review_grant`, canonical `grant_id`, `manifest_hash`, `issuance_digest` и exact authorization conditions обязательны. Router только выбирает admissible provider; **до dispatch** trusted reviewer boundary обязан выполнить S-0010 canonical verification и durable one-consumption reservation. Selection never substitutes grant admission.

Selection pipeline обязан быть разделён на hard filters и soft ranking.

#### Hard filters

Кандидат исключается, если:

1. нет required capability/role;
2. trusted descriptor provenance отсутствует/невалидна для security-sensitive role;
3. нарушена independence requirement;
4. independent reviewer совпадает с trusted artifact producer или не доказано требуемое separation;
5. provider/adapter не разрешён policy;
6. `availability=UNAVAILABLE`;
7. `invokable=NO`;
8. `quota_state=EXHAUSTED`;
9. `rate_limit_state=RATE_LIMITED` и reset/cooldown ещё не прошёл;
10. required credential readiness = `NO`;
11. permissions шире task authority;
12. required authority отсутствует/unverified или не разрешает requested action;
13. provider metered, но `budget.paid_allowed=false`;
14. provider metered, но cost estimate/currency unknown, malformed или несопоставим с task budget;
15. provider metered и proven cost выше `max_cost_minor_units`;
16. applicable governance требует конкретную identity/class и fallback меняет смысл gate.

`UNKNOWN` не равен автоматически `NO`, но unknown authority, independence, descriptor provenance или credential readiness всегда блокирует security-sensitive/consequential invocation. Unknown cost/currency всегда блокирует metered invocation независимо от criticality.

#### Soft ranking

После hard filters допустимые кандидаты сортируются data-driven policy, как минимум по:

`quality/confidence → resource headroom → cost → latency → health/stability`.

Конкретные веса не должны быть зашиты в provider-specific `if/else`. Policy version, canonical policy reference/hash и причины выбора сохраняются в decision evidence.

Router обязан вернуть либо:

```json
{
  "decision": "SELECTED",
  "provider_id": "...",
  "adapter_id": "...",
  "policy_version": "...",
  "policy_ref": "github:...",
  "authority_ref": "github:...|null",
  "grant_id": "string|null",
  "manifest_hash": "sha256|null",
  "artifact_producer_ref": "string|null",
  "reasons": ["..."],
  "rejected": [{"provider_id":"...","adapter_id":"...","reason":"..."}]
}
```

либо:

```json
{
  "decision": "BLOCKED",
  "reason": "NO_ADMISSIBLE_PROVIDER|RESOURCE_STATE_UNKNOWN|BUDGET_AUTH_REQUIRED|GOVERNANCE_AUTH_REQUIRED|PRODUCER_IDENTITY_UNVERIFIED|REGISTRY_PROVENANCE_INVALID",
  "rejected": []
}
```

Routing decision is evidence of selection only. It is never evidence that model/executor dispatch authority has been consumed or that a later consequential gate is granted.

## 5. Adapter Contract

Каждый adapter должен реализовывать логически одинаковые capabilities; конкретный transport может различаться.

Обязательные операции интерфейса:

```text
describe()           -> RuntimeDescriptorObservation
observe()            -> ResourceSnapshot
canInvoke(envelope)  -> admissibility detail
invoke(envelope)     -> InvocationReceipt | UNKNOWN
poll?(receipt)       -> normalized status/event
reconcile?(attempt)  -> read-only reconciliation result
cancel?(receipt)     -> normalized result
normalizeEvent(raw)  -> NormalizedAgentEvent
```

`invoke` не должен сам выбирать budget/governance policy. Он получает уже допустимый bounded `InvocationEnvelope`, сформированный trusted Genesis boundary после routing и authority admission.

### 5.1 InvocationEnvelope

Минимально:

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
  "artifact_producer_ref": "string|null",
  "repository": "owner/repo|null",
  "pr_number": "number|null",
  "expected_head_sha": "40-char sha|null",
  "authorized_actions": ["string"]
}
```

Для S-0010 reviewer invocation envelope должен содержать exact canonical grant binding; trusted reviewer boundary резервирует grant до model dispatch в соответствии с S-0010. Generic adapter не может пропустить этот этап.

### 5.2 InvocationReceipt

Receipt — non-secret operational recovery identity, не project SoT и не новая authority.

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
  "dispatch_state": "PREPARED|DISPATCH_CONFIRMED|UNKNOWN|COMPLETED|FAILED_NO_DISPATCH",
  "external_job_id": "string|null",
  "reconciliation_key": "non-secret-string|null",
  "prepared_at": "RFC3339",
  "dispatched_at": "RFC3339|null",
  "updated_at": "RFC3339"
}
```

Write ordering / crash semantics:

1. Before any external invoke, operational durable store atomically writes `PREPARED` with exact task/run/attempt/provider/adapter/request/authority identities.
2. If applicable authority/grant requires consumption reservation, that reservation must be durably admitted before external dispatch according to its canonical contract.
3. Adapter dispatch may occur only for the exact persisted `PREPARED` attempt.
4. On provider acknowledgement with stable external id/correlation, durable state becomes `DISPATCH_CONFIRMED` with `external_job_id`/`reconciliation_key` before returning success upstream.
5. If a deterministic failure is proven before dispatch, state becomes `FAILED_NO_DISPATCH`; bounded retry/fallback may be evaluated by policy.
6. If a crash/timeout/response loss leaves uncertainty whether dispatch occurred, state becomes or remains `UNKNOWN`; automatic second invoke for a paid/consequential/non-idempotent action is forbidden.
7. `reconcile(attempt)` is read-only. It must use provider-supported stable job/correlation/idempotency identity. If provider cannot prove dispatch/non-dispatch, attempt remains `UNKNOWN`.
8. Only proven `FAILED_NO_DISPATCH` can be treated as no-call/no-side-effect for retry policy. `UNKNOWN` is never silently cleared by TTL.

Adapter обязан:

- не расширять scope/authority;
- не раскрывать secrets в snapshots/events/results/receipts;
- возвращать stable external job/request id, если provider его выдаёт;
- нормализовать provider rate-limit/quota signals без выдумывания отсутствующих данных;
- документировать cancellation/recovery semantics;
- сообщать, поддерживает ли event-first completion; если нет — polling fallback capability;
- поддерживать read-only reconciliation, если provider предоставляет соответствующий API/identity;
- не доверять provider self-claims о governance role/independence/permissions вместо canonical registry.

## 6. Event-first continuation

Для GitHub-native агентов предпочтительный v0.1 transport:

```text
GitHub event
→ trusted source verification
→ normalizeEvent
→ composite-key deduplicate
→ exact task/run/attempt/PR/HEAD check
→ persist/reconcile durable fact
→ load current GitHub task state
→ validate result/review evidence
→ route next already-authorized step
```

Минимально поддерживаемые GitHub classes для adapters, если применимо:

- `pull_request` / PR HEAD movement;
- `pull_request_review`;
- `issue_comment`;
- checks/status completion;
- provider-specific GitHub comment/check convention.

S-0011 не требует один универсальный webhook endpoint для всех систем. Требуется единый normalized contract после provider-specific source verification.

### 6.1 Event continuation gate

Перед любым autonomous continuation core должен проверить:

- canonical event dedupe key + payload hash;
- trusted source namespace;
- exact task/run/attempt association;
- current GitHub task state;
- current PR HEAD для HEAD-bound результата;
- applicable authority всё ещё покрывает следующий шаг;
- result-specific validator completed;
- для review — Normalized Review Result + trusted GitHub evidence read-back по Section 4.3.1.

Если любой security/consequential binding unknown/stale/conflicting — STOP/BLOCKED, не fallback around governance.

## 7. Adaptive fallback

Fallback разрешён только между кандидатами, которые проходят тот же TaskRequirements/governance envelope.

Примеры:

- бесплатный coding executor quota exhausted → другой разрешённый бесплатный coding executor;
- Qodo unavailable → другой разрешённый independent reviewer, если independence contract остаётся эквивалентным;
- Grok требуется как non-OpenAI independent reviewer → OpenAI provider не является эквивалентным fallback;
- metered provider при `paid_allowed=false` → BLOCKED, не auto-charge;
- metered provider с unknown/incomparable cost → BLOCKED даже если task urgent;
- provider с privileged write при read-only task → не выбирается без отдельной authority;
- новый provider с unapproved registry role/independence claims → не может стать fallback.

Каждый fallback создаёт новый routing decision с причиной; предыдущая failure/resource evidence сохраняется. Fallback не переиспользует consumed/closed/unknown authorization grant, если canonical contract требует новую issuance.

## 8. Recovery и crash semantics

1. Core не должен считать `invoke()` успешным без durable `DISPATCH_CONFIRMED` receipt или эквивалентной доказуемой external identity.
2. `PREPARED` после crash требует reconciliation до dispatch, если нельзя доказать, что external call ещё не произошёл.
3. Если неизвестно, был ли provider вызван, состояние = `UNKNOWN`; повторный invoke запрещён до read-only reconciliation, если повтор может создать consequential/paid side effect.
4. Duplicate completion events безопасно replay/no-op по composite event key + payload hash.
5. После crash Genesis восстанавливает project state из GitHub и runtime attempt/dedupe state из допустимого operational store.
6. Runtime store не может переписать GitHub project truth.
7. Stale task/run/attempt/PR/HEAD event после recovery отбрасывается.
8. Не вводить бесконечные retries; retry/fallback policy bounded и versioned.
9. Provider без надёжной read-only reconciliation способности для non-idempotent consequential call может быть policy-rejected до dispatch, если риск unrecoverable UNKNOWN неприемлем.
10. S-0010 reviewer grant lifecycle остаётся более строгим там, где он применим: RESERVED/CONSUMED/CLOSED_NO_CALL/UNKNOWN semantics не ослабляются generic orchestration.

## 9. Security / governance invariants

- no secrets in registry/resource/event/routing/receipt evidence;
- no automatic privilege escalation;
- no automatic paid escalation without policy;
- no provider gains authority by registration;
- aliases never change security/independence identity;
- security-sensitive registry claims require canonical trusted provenance;
- exact PR HEAD required where result validity is HEAD-bound;
- trusted artifact producer identity required for independent review;
- same artifact producer cannot satisfy an independence rule that requires a distinct independence class;
- reviewer invocation stays bound to S-0009/S-0010 authorization/evidence rules when those specs apply;
- external provider claims are untrusted until adapter verification against canonical registry/policy;
- unknown governance/identity/cost state fails closed where it can alter authority, money, independence or consequential correctness;
- Ready/Merge/Deploy/LIVE remain separate gates unless a later explicit bounded autonomy policy changes them;
- DR-0008 restrictions remain unchanged.

## 10. v0.1 implementation slices

После Approval и отдельного Execution Authorization реализацию следует делать небольшими PR/slices, а не одним giant orchestrator rewrite.

### Slice A — trusted contracts + pure router

- canonical provider descriptor validation + descriptor hash/provenance;
- resource snapshot normalization;
- TaskRequirements/authority/producer binding validation;
- budget minor-unit/currency validation;
- hard-filter + deterministic ranking;
- routing decision evidence;
- no network, no runtime routing mutation.

### Slice B — event normalization + dedupe + attempt receipts

- normalized event schema + trusted source namespace;
- composite event key + canonical payload hash;
- exact task/run/attempt/PR/HEAD freshness checks;
- duplicate/no-op and conflict behavior;
- InvocationEnvelope/Receipt state machine;
- bounded polling representation;
- read-only reconciliation interface.

### Slice C — first real adapters

Минимум два разнотипных adapters, чтобы доказать provider neutrality. Предпочтительно один GitHub-native executor/reviewer + один API/plugin/provider adapter. Конкретные бренды выбираются в отдельном EA по фактической доступности на момент реализации.

Для independent reviewer adapter нельзя обходить S-0009/S-0010: canonical authorization/grant, producer independence, exact HEAD, result validation и trusted evidence обязательны.

### Slice D — One-Window continuation trial

Один controlled trial:

```text
CEO goal
→ trusted authority/task envelope
→ auto selection
→ durable attempt reservation
→ one adapter invocation
→ completion event
→ result validation
→ one autonomous next non-consequential already-authorized step
→ CEO receives summary/gate
```

Никаких auto-merge/deploy/LIVE.

## 11. Минимальный test matrix

### Registry / descriptor

- valid canonical descriptor accepted;
- duplicate identity rejected;
- alias collision cannot replace security identity;
- `Julius` alias maps to `Jules`, not second provider;
- malformed permissions/capabilities rejected;
- runtime self-description cannot elevate role/independence/permissions;
- missing/invalid registry authority/hash blocks security-sensitive selection.

### Resource awareness / budget

- exact provider quota mapped when proven;
- absent quota => UNKNOWN, not guessed;
- exhausted/rate-limited candidates filtered;
- stale snapshot handled by policy;
- secret-like fields rejected/redacted;
- metered candidate with unknown cost blocked;
- currency mismatch blocked;
- compatible proven estimate <= cap accepted;
- proven estimate > cap blocked.

### Router / authority / independence

- capability mismatch rejected;
- trusted artifact producer self-review rejected;
- unknown producer identity blocks independent-review selection;
- independence mismatch rejected;
- free available provider preferred when paid forbidden;
- paid candidate blocked without budget policy;
- more privileged adapter rejected;
- required authority missing/unverified blocked;
- S-0010 reviewer selection without canonical grant fields cannot reach dispatch;
- deterministic output for same inputs;
- all candidates rejected => explicit BLOCKED reason;
- UNKNOWN critical authority/budget state fails closed.

### Review result

- generic REVIEW_COMPLETED alone cannot become gate evidence;
- expected/reviewed/acceptance HEAD mismatch => not gate safe;
- malformed/contradictory verdict/finding state rejected;
- missing trusted GitHub persistence/read-back rejected;
- valid S-0010 grant/result/evidence binding accepted for evaluation only; does not create next gate authority.

### Events

- duplicate same composite key + same payload => replay/no-op;
- same composite key + changed payload => conflict;
- same local event_id from two different providers does not collide;
- stale PR HEAD => blocked continuation;
- wrong task/run/attempt => ignored/blocked;
- completion does not imply consequential authority;
- bounded polling stops at max attempts/window.

### Recovery / receipt

- PREPARED persists before provider dispatch;
- provider acknowledgement persists DISPATCH_CONFIRMED before success returns upstream;
- crash/response loss around dispatch becomes UNKNOWN when dispatch cannot be proven;
- UNKNOWN does not auto-repeat paid/consequential invocation;
- deterministic pre-dispatch failure can become FAILED_NO_DISPATCH;
- read-only reconciliation can resolve only with provider-supported evidence;
- duplicate completion after reconstruction remains idempotent;
- reviewer grant lifecycle remains S-0010-compliant during crash cases.

## 12. Acceptance criteria v0.1

S-0011 implementation считается доказанной только если одновременно выполнено:

1. Core routing code не содержит provider-name branching для выбора (`if provider === Qodo/Grok/...`).
2. Новый provider можно добавить adapter + canonical descriptor без изменения core selection algorithm.
3. Security-sensitive descriptor fields имеют trusted versioned GitHub provenance и не могут self-elevate из adapter output.
4. Resource unknowns не подменяются догадками.
5. Metered invocation невозможен без proven compatible cost/currency within budget.
6. Router выдаёт deterministic explainable decision/rejections и сохраняет policy/authority/producer refs.
7. At least two distinct adapters pass same contract tests.
8. Completion event может продолжить один разрешённый workflow без ручного CEO `проверь`.
9. Duplicate/cross-provider-collision/stale events не создают потерю события или второй invoke/side effect.
10. InvocationReceipt/attempt recovery доказан crash tests; UNKNOWN не auto-retries consequential/paid work.
11. Independent reviewer routing доказуемо исключает self-review через trusted producer identity.
12. S-0009/S-0010 reviewer grant + exact-HEAD + durable evidence rules не ослаблены generic orchestration.
13. Paid/privileged/independence-changing fallback fail closed без authority.
14. Exact task/run/attempt/PR/HEAD freshness доказана тестами там, где применимо.
15. GitHub остаётся SoT, operational state не становится конкурирующим project DB.
16. Full affected test suite green.
17. Independent review относится к exact PR HEAD.
18. Ready/merge/deploy/LIVE не выполняются без отдельного CEO gate.

## 13. Non-goals v0.1

- не строить новый большой control plane;
- не создавать vector DB только ради routing;
- не переносить project SoT из GitHub;
- не поддерживать каждый существующий AI provider в первом PR;
- не auto-buy/auto-top-up credits;
- не делать currency conversion без отдельного policy contract;
- не auto-merge/deploy/LIVE;
- не давать Grok/Qodo/Codex/Copilot/Jules/Astra standing authority;
- не заменять S-0009/S-0010 reviewer security contract;
- не снимать DR-0008;
- не делать Dify обязательной зависимостью.

## 14. Implementation allowlist after Approval

Точный allowlist должен быть закреплён отдельным EA. Рекомендуемая верхняя граница первого Slice A/B:

- `services/genesis-broker/src/agent-*`
- `services/genesis-broker/src/adaptive-router.js`
- `services/genesis-broker/tests/agent-*.test.js`
- `services/genesis-broker/tests/adaptive-router.test.js`
- `docs/genesis-broker/agent-orchestration.md`
- `specifications/S-0011-Genesis-Universal-Adaptive-Agent-Orchestration-v0.1.md`
- `specifications/INDEX.md`
- `bridge/QUEUE.md` / `bridge/HANDOFF.md` только если отдельный EA требует task-state synchronization.

Production route wiring, Durable Object schema migration, webhook endpoint, secret/config changes, Cloudflare deployment и provider LIVE calls должны быть отдельными stages/gates.

## 15. Decision Record requirement

Новый DR не обязателен для Slice A/B, если реализация остаётся тонким provider-neutral слоем внутри существующих границ GitHub SoT и Broker runtime.

Новый/обновлённый DR обязателен до реализации, если появляется хотя бы одно:

- новый persistent project/control-plane SoT;
- новая credential trust boundary;
- standing autonomy / chained consequential authority;
- automatic paid spending policy;
- privileged provider acting without existing gate model;
- materially new production event infrastructure whose failure semantics меняют governance guarantees.

## 16. Проверка спецификации перед Approval

Independent reviewer должен проверить минимум:

- provider neutrality без скрытой привязки к текущему набору агентов;
- trusted registry provenance / no self-elevation;
- separation hard governance filters vs soft ranking;
- canonical authority propagation и S-0010 grant admission before reviewer dispatch;
- trusted artifact producer binding / self-review prevention;
- correctness UNKNOWN semantics;
- budget currency/minor-unit correctness;
- event namespace + idempotency + stale exact HEAD rejection;
- InvocationReceipt write ordering + crash/duplicate invocation risk;
- review completion vs gate-safe review evidence separation;
- paid/privileged fallback boundaries;
- GitHub SoT preservation;
- реалистичность Slice A→D без giant rewrite.

Проверка выполнена: clean independent Qodo review относился к exact pre-approval HEAD `ea6cd59a4fb0db769ffa53100aabfd4937ee1719`; CEO утвердил S-0011 Revision 1 2026-09-11. Approval не является Execution Authorization.