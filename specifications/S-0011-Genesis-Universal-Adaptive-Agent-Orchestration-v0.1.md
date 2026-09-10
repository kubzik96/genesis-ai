# S-0011 — Genesis Universal Adaptive Agent Orchestration v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0011 |
| Title | Genesis Universal Adaptive Agent Orchestration v0.1 |
| Status | **Draft** |
| Revision | 1 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-11 |
| Related Issue | #121 |
| Related Specifications | S-0007 Revision 1; S-0009 Revision 1; S-0010 Revision 2 |
| Related Decisions | DR-0005; DR-0008; DR-0010; DR-0011 |
| Execution Authorization | **NOT_GRANTED — implementation requires separate CEO approval + EA** |

## 1. Цель

Сделать следующий One-Window слой Genesis provider-neutral: CEO задаёт цель один раз, а Genesis сам определяет требуемую роль, видит доступные adapters/providers, выбирает лучший допустимый путь, запускает исполнителя, узнаёт о завершении/лимите, проверяет результат и продолжает до следующего consequential CEO gate.

Целевой поток:

```text
CEO goal
→ task requirements
→ provider registry
→ resource snapshot
→ policy filter
→ adaptive selection
→ invoke adapter
→ normalized event
→ exact task/run/PR/HEAD validation
→ result validation
→ next allowed step or CEO gate
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
RESULT: completed / blocked
NEXT: autonomous_step | CEO_GATE_REQUIRED
EVIDENCE: GitHub exact task/run/PR/HEAD reference
```

## 3. Канонические границы

1. GitHub остаётся единственным durable Source of Record для project state, решений, task/evidence и consequential gate evidence.
2. Runtime cache/DO/queue может хранить только оперативное состояние доставки, дедупликации, lease/attempt и resource snapshot. Это не второй project SoT.
3. Подключение provider не создаёт ему authority.
4. Событие `COMPLETED` не создаёт Ready/Merge/Deploy/LIVE authority.
5. Платный fallback не допускается без применимой budget/authorization policy.
6. Provider с более широкими permissions не выбирается автоматически, если task authority их не покрывает.
7. Нельзя выдумывать quota, reset, cost, health или availability. Недоказуемое значение = `UNKNOWN`.
8. DR-0008 сохраняет силу. S-0011 не снимает quarantine и не разрешает production Broker/xAI/Dify/Cloudflare действия.

## 4. Минимальная архитектура v0.1

S-0011 требует четыре небольших слоя. Они должны быть независимыми от конкретных брендов.

### 4.1 Provider Registry

Реестр descriptors/adapters. Каждая запись имеет стабильную security identity и может иметь человекочитаемые aliases.

Минимальный descriptor:

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
  "cost_class": "free|metered|unknown"
}
```

Требования:

- `provider_id + adapter_id` образуют стабильную identity;
- aliases не меняют security identity;
- `Julius` может быть alias для `Jules`, но не отдельной identity;
- новый provider добавляется descriptor + adapter, без изменения core routing logic;
- duplicate identity, неизвестные capability/role enums и malformed descriptors fail closed.

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
  "estimated_cost": "number|null",
  "currency": "string|null",
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
- runtime error при чтении ресурса = `UNKNOWN` или `UNAVAILABLE` только если это доказуемо по контракту adapter.

### 4.3 Normalized Agent Event

Core должен получать события в едином формате независимо от GitHub webhook, provider webhook, callback, job status API или bounded polling.

Минимальный event contract:

```json
{
  "event_id": "stable-source-event-id",
  "event_type": "AGENT_SELECTED|AGENT_STARTED|AGENT_WAITING|AGENT_COMPLETED|AGENT_FAILED|REVIEW_STARTED|REVIEW_COMPLETED|LIMIT_EXHAUSTED|RATE_LIMITED|RESET_AT|PROVIDER_UNAVAILABLE",
  "provider_id": "string",
  "adapter_id": "string",
  "task_id": "string",
  "run_id": "string",
  "repository": "owner/repo|null",
  "pr_number": "number|null",
  "head_sha": "40-char sha|null",
  "occurred_at": "RFC3339",
  "source": "github_webhook|provider_webhook|callback|status_api|polling",
  "evidence_ref": "string|null"
}
```

Обязательные свойства:

- event delivery idempotent по `event_id`;
- duplicate event = replay/no-op;
- один `event_id` с другим payload = conflict/fail closed;
- событие, привязанное к PR, обязано иметь exact 40-char `head_sha` для действий, зависящих от HEAD;
- stale HEAD event нельзя использовать для продолжения consequential workflow;
- event относится только к точному `task_id + run_id`;
- событие не создаёт authority само по себе;
- polling разрешён только bounded fallback с фиксированным max attempts/window.

### 4.4 Adaptive Router

Router получает `TaskRequirements`, Provider Registry и Resource Snapshots и возвращает deterministic selection decision.

Минимальный `TaskRequirements`:

```json
{
  "task_id": "string",
  "run_id": "string",
  "required_capabilities": ["string"],
  "required_role": "string",
  "required_independence_class": "string|null",
  "allowed_permissions": ["read_only", "bounded_write"],
  "paid_allowed": false,
  "max_estimated_cost": 0,
  "latency_preference": "low|normal|irrelevant",
  "criticality": "low|normal|high|consequential",
  "allowed_providers": ["string"]
}
```

Selection pipeline обязан быть разделён на hard filters и soft ranking.

#### Hard filters

Кандидат исключается, если:

1. нет required capability/role;
2. нарушена independence requirement;
3. provider/adapter не разрешён policy;
4. `availability=UNAVAILABLE`;
5. `invokable=NO`;
6. `quota_state=EXHAUSTED`;
7. `rate_limit_state=RATE_LIMITED` и reset/cooldown ещё не прошёл;
8. required credential readiness = `NO`;
9. permissions шире task authority;
10. provider metered, но `paid_allowed=false`;
11. доказуемая estimated cost выше budget cap;
12. applicable governance требует конкретную identity/class и fallback меняет смысл gate.

`UNKNOWN` не равен автоматически `NO`, но для consequential/privileged operation policy MUST fail closed, если неизвестность относится к authority, independence, credential readiness или cost/budget boundary.

#### Soft ranking

После hard filters допустимые кандидаты сортируются data-driven policy, как минимум по:

`quality/confidence → resource headroom → cost → latency → health/stability`.

Конкретные веса не должны быть зашиты в provider-specific `if/else`. Policy version и причины выбора сохраняются в decision evidence.

Router обязан вернуть либо:

```json
{
  "decision": "SELECTED",
  "provider_id": "...",
  "adapter_id": "...",
  "policy_version": "...",
  "reasons": ["..."],
  "rejected": [{"provider_id":"...","reason":"..."}]
}
```

либо:

```json
{
  "decision": "BLOCKED",
  "reason": "NO_ADMISSIBLE_PROVIDER|RESOURCE_STATE_UNKNOWN|BUDGET_AUTH_REQUIRED|GOVERNANCE_AUTH_REQUIRED",
  "rejected": []
}
```

## 5. Adapter Contract

Каждый adapter должен реализовывать логически одинаковые capabilities; конкретный transport может различаться.

Обязательные операции интерфейса:

```text
describe()       -> ProviderDescriptor
observe()        -> ResourceSnapshot
canInvoke(task)  -> admissibility detail
invoke(task)     -> InvocationReceipt
poll?(receipt)   -> normalized status/event
cancel?(receipt) -> normalized result
normalizeEvent(raw) -> NormalizedAgentEvent
```

`invoke` не должен сам выбирать budget/governance policy. Он получает уже допустимый bounded task envelope.

Adapter обязан:

- не расширять scope/authority;
- не раскрывать secrets в snapshots/events/results;
- возвращать stable external job/request id, если provider его выдаёт;
- нормализовать provider rate-limit/quota signals без выдумывания отсутствующих данных;
- документировать cancellation/recovery semantics;
- сообщать, поддерживает ли event-first completion; если нет — polling fallback capability.

## 6. Event-first continuation

Для GitHub-native агентов предпочтительный v0.1 transport:

```text
GitHub event
→ source verification
→ normalizeEvent
→ deduplicate
→ exact task/run/PR/HEAD check
→ persist/reconcile durable fact
→ load current GitHub task state
→ route next already-authorized step
```

Минимально поддерживаемые GitHub classes для адаптеров, если применимо:

- `pull_request` / PR HEAD movement;
- `pull_request_review`;
- `issue_comment`;
- checks/status completion;
- provider-specific GitHub comment/check convention.

S-0011 не требует один универсальный webhook endpoint для всех систем. Требуется единый normalized contract после provider-specific verification.

## 7. Adaptive fallback

Fallback разрешён только между кандидатами, которые проходят тот же TaskRequirements/governance envelope.

Примеры:

- бесплатный coding executor quota exhausted → другой разрешённый бесплатный coding executor;
- Qodo unavailable → другой разрешённый independent reviewer;
- Grok требуется как non-OpenAI independent reviewer → OpenAI provider не является эквивалентным fallback;
- metered provider при `paid_allowed=false` → BLOCKED, не auto-charge;
- provider с privileged write при read-only task → не выбирается без отдельной authority.

Каждый fallback создаёт новый routing decision с причиной; предыдущая failure/resource evidence сохраняется.

## 8. Recovery и crash semantics

1. Core не должен считать `invoke()` успешным без durable invocation receipt или доказуемого external job identity.
2. Если неизвестно, был ли provider вызван, состояние = `UNKNOWN`; повторный invoke запрещён до read-only reconciliation, если повтор может создать consequential/paid side effect.
3. Duplicate completion events безопасно replay/no-op.
4. После crash Genesis восстанавливает project state из GitHub и runtime attempt/dedupe state из допустимого operational store.
5. Runtime store не может переписать GitHub project truth.
6. Stale task/run/PR/HEAD event после recovery отбрасывается.
7. Не вводить бесконечные retries; retry/fallback policy bounded и versioned.

## 9. Security / governance invariants

- no secrets in registry/resource/event/routing evidence;
- no automatic privilege escalation;
- no automatic paid escalation without policy;
- no provider gains authority by registration;
- aliases never change security/independence identity;
- exact PR HEAD required where result validity is HEAD-bound;
- same artifact producer cannot satisfy an independence rule that requires a distinct independence class;
- external provider claims are untrusted until adapter verification;
- unknown governance/identity/cost state fails closed for consequential actions;
- Ready/Merge/Deploy/LIVE remain separate gates unless a later explicit bounded autonomy policy changes them;
- DR-0008 restrictions remain unchanged.

## 10. v0.1 implementation slices

После Approval и отдельного Execution Authorization реализацию следует делать небольшими PR/slices, а не одним гигантским orchestrator rewrite.

### Slice A — contracts + pure router

- provider descriptor validation;
- resource snapshot normalization;
- TaskRequirements validation;
- hard-filter + deterministic ranking;
- no network, no runtime routing mutation.

### Slice B — event normalization + dedupe

- normalized event schema;
- exact task/run/PR/HEAD freshness checks;
- duplicate/no-op and conflict behavior;
- bounded polling representation.

### Slice C — first real adapters

Минимум два разнотипных adapters, чтобы доказать provider neutrality. Предпочтительно один GitHub-native executor/reviewer + один API/plugin/provider adapter. Конкретные бренды выбираются в отдельном EA по фактической доступности на момент реализации.

### Slice D — One-Window continuation trial

Один controlled trial:

```text
CEO goal
→ auto selection
→ one adapter invocation
→ completion event
→ result validation
→ one autonomous next non-consequential step
→ CEO receives summary/gate
```

Никаких auto-merge/deploy/LIVE.

## 11. Минимальный test matrix

### Registry / descriptor

- valid descriptor accepted;
- duplicate identity rejected;
- alias collision cannot replace security identity;
- `Julius` alias maps to `Jules`, not second provider;
- malformed permissions/capabilities rejected.

### Resource awareness

- exact provider quota mapped when proven;
- absent quota => UNKNOWN, not guessed;
- exhausted/rate-limited candidates filtered;
- stale snapshot handled by policy;
- secret-like fields rejected/redacted.

### Router

- capability mismatch rejected;
- independence mismatch rejected;
- free available provider preferred when paid forbidden;
- paid candidate blocked without budget policy;
- more privileged adapter rejected;
- deterministic output for same inputs;
- all candidates rejected => explicit BLOCKED reason;
- UNKNOWN critical authority/budget state fails closed.

### Events

- duplicate same event id + same payload => replay/no-op;
- same event id + changed payload => conflict;
- stale PR HEAD => blocked continuation;
- wrong task/run => ignored/blocked;
- completion does not imply consequential authority;
- bounded polling stops at max attempts/window.

### Recovery

- crash after invocation receipt resumes observation, not duplicate invoke;
- unknown dispatch state does not auto-repeat paid/consequential call;
- duplicate completion after reconstruction remains idempotent.

## 12. Acceptance criteria v0.1

S-0011 implementation считается доказанной только если одновременно выполнено:

1. Core routing code не содержит provider-name branching для выбора (`if provider === Qodo/Grok/...`).
2. Новый provider можно добавить adapter + descriptor без изменения core selection algorithm.
3. Resource unknowns не подменяются догадками.
4. Router выдаёт deterministic explainable decision/rejections.
5. At least two distinct adapters pass same contract tests.
6. Completion event может продолжить один разрешённый workflow без ручного CEO `проверь`.
7. Duplicate/stale events не создают второй invoke/side effect.
8. Paid/privileged/independence-changing fallback fail closed без authority.
9. Exact task/run/PR/HEAD freshness доказана тестами там, где применимо.
10. GitHub остаётся SoT, operational state не становится конкурирующим project DB.
11. Full affected test suite green.
12. Independent review относится к exact PR HEAD.
13. Ready/merge/deploy/LIVE не выполняются без отдельного CEO gate.

## 13. Non-goals v0.1

- не строить новый большой control plane;
- не создавать vector DB только ради routing;
- не переносить project SoT из GitHub;
- не поддерживать каждый существующий AI provider в первом PR;
- не auto-buy/auto-top-up credits;
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
- separation hard governance filters vs soft ranking;
- correctness UNKNOWN semantics;
- event idempotency + stale exact HEAD rejection;
- crash/duplicate invocation risk;
- paid/privileged fallback boundaries;
- GitHub SoT preservation;
- реалистичность Slice A→D без giant rewrite.

После independent review CEO отдельно принимает или отклоняет S-0011 Revision 1. Approval не является Execution Authorization.