# DR-0012 — Universal Adaptive Agent Orchestration Architecture

## Идентификатор

DR-0012

## Название

Universal Adaptive Agent Orchestration Architecture

## Статус

**Предложено**

## Дата

2026-09-11

## Автор предложения

ChatGPT — COO, по поручению CEO Genesis AI

---

# Контекст

S-0011 Revision 3 определяет provider-neutral Universal Adaptive Agent Orchestration и уже одобрена CEO после независимого exact-HEAD review. Спецификация требует отдельный принятый Decision Record до начала Slice A/B implementation.

На момент создания этого Proposed DR одобренный S-0011 Revision 3 находится в Draft PR #122 на approval-sync HEAD `c2e3c91377764a5a689e620a9a962a03cac5a585`, а current `main` ещё не содержит S-0011. Поэтому этот DR может проходить предварительный review, но **не может быть CEO Accepted, merged или использован как prerequisite для implementation**, пока PR #122 не будет отдельно Ready/merged и DR-0012 не будет повторно сверён с S-0011 из нового current `main`. DR-0012 не копирует S-0011 в свой scope и не расширяет двухфайловый docs-only PR.

Genesis уже имеет существующий Broker, GitHub-backed Source of Truth, independent-review contracts S-0009/S-0010, F1/F2 reviewer-runtime work и ограниченные adapter paths для Codex, Grok/xAI и других исполнителей. Новая capability не должна создавать второй control plane или второй Source of Truth. Она должна собирать существующие границы в одну детерминированную orchestration architecture.

DR-0008 остаётся обязательным security boundary: это решение не снимает Broker quarantine, не включает LIVE, не разрешает authenticated production Broker calls, secrets/PAT mutation, Dify run/publish или production model calls.

---

# Цель

Зафиксировать минимальную архитектуру, достаточную для реализации S-0011 Slice A/B:

1. trusted Provider Registry и deterministic Adaptive Router;
2. normalized agent events и durable attempt lifecycle;
3. event dedupe и continuation checkpoints;
4. per-effect identity, versioned request hashing и destination capability classes A/B/C;
5. crash/replay recovery и fail-closed UNKNOWN reconciliation;
6. интеграцию S-0009/S-0010 reviewer/grant semantics;
7. использование существующего Genesis Broker как runtime boundary без создания нового project/control-plane SoT.

---

# Архитектурные варианты

## Вариант A — отдельный новый orchestration service/control plane

Преимущества:

- чистое разделение нового кода;
- можно независимо масштабировать runtime.

Риски:

- создаёт второй control plane;
- дублирует Broker state и governance boundaries;
- повышает complexity, credential surface и recovery ambiguity;
- противоречит минимальной архитектуре S-0011.

**Отклонено.**

## Вариант B — расширить существующий Genesis Broker provider-specific ветками

Преимущества:

- минимальный deploy footprint;
- использует существующую runtime инфраструктуру.

Риски:

- core превращается в набор `if provider == ...`;
- provider-specific logic смешивается с governance;
- сложно доказать deterministic routing и одинаковые safety contracts.

**Отклонено как основной архитектурный принцип.** Adapter-specific code допустим только за единым contract boundary.

## Вариант C — provider-neutral orchestration components внутри существующей Broker/runtime boundary

Компоненты являются детерминированными contracts/state machines, а providers подключаются адаптерами. GitHub остаётся project SoT; runtime durable state хранит только operational recovery state.

Преимущества:

- соответствует S-0011;
- не создаёт второй control plane;
- provider addition не требует изменения core router algorithm;
- governance и runtime authority остаются раздельными;
- можно реализовать Slice A как pure contracts, затем Slice B как bounded durable recovery.

Риски:

- требуется строгая canonicalization/versioning discipline;
- runtime state machine сложнее обычного job queue;
- safe crash recovery для внешних effects иногда обязан останавливаться в UNKNOWN.

**Выбран вариант C.**

---

# Решение

## 1. Control-plane и Source of Truth

GitHub `kubzik96/genesis-ai` остаётся единственным durable project/governance Source of Truth.

Genesis Broker/runtime MAY хранить только operational state, необходимый для execution/recovery:

- provider/resource observations;
- routing decisions;
- attempts and receipts;
- accepted-event dedupe records;
- continuation checkpoints;
- effect records and dispatch episodes;
- reconciliation evidence/status.

Этот runtime state не может создавать Specifications, Decisions, CEO authority, Ready/merge/deploy permission или заменять GitHub task/PR/HEAD evidence.

## 2. Trusted Provider Registry

Provider security identity — `(provider_id, adapter_id)`.

Trusted registry material хранится в versioned GitHub artifacts. Security-sensitive поля — capabilities, roles, independence class, permissions class, invocation modes и cost class — не принимаются из self-reported runtime metadata.

Descriptor canonicalization/hash следует S-0011. Unknown, malformed, stale или conflicting provenance блокирует consequential selection.

Добавление нового provider должно требовать canonical descriptor + adapter, но не provider-name branch в core routing algorithm.

## 3. Adaptive Router

Router является deterministic pure decision component для Slice A.

Порядок:

1. принять TaskRequirements, trusted registry и ResourceSnapshots;
2. применить hard governance filters;
3. отклонить candidates с unknown security-sensitive state;
4. применить versioned ranking policy только к доказанным inputs;
5. завершить total ordering стабильным `(provider_id, adapter_id, model_id-or-empty)` tie-break;
6. вернуть `SELECTED` или explicit `BLOCKED` плюс evidence/reasons.

Router не создаёт authority и не выполняет network call.

Paid/more-privileged fallback не допускается без уже существующей compatible authority/budget policy.

## 4. Adapter boundary

Каждый provider реализует единый logical interface S-0011: observe/admissibility/invoke/poll/reconcile/cancel/normalizeEvent по применимой capability.

Adapter:

- не выбирает governance policy;
- не расширяет authority;
- не определяет свою independence/security class;
- не может переводить UNKNOWN в success по эвристике;
- не может обходить exact task/run/attempt/PR/HEAD checks.

Provider-specific transport остаётся внутри adapter.

## 5. Normalized events и durable attempts

Все asynchronous provider observations нормализуются в закрытый event contract S-0011.

Accepted event требует:

- trusted source namespace;
- canonical event identity/hash;
- exact attempt/receipt correlation, где применимо;
- monotonic attempt-state admission;
- atomic accepted-dedupe + attempt-state transition + continuation checkpoint creation.

Attempt state является durable operational state. Terminal state не регрессирует. Ambiguous dispatch/cancellation/effect становится UNKNOWN и не продолжает workflow автономно.

## 6. Event dedupe и continuation checkpoint

Один accepted canonical event создаёт ровно один checkpoint.

Replay:

- `COMPLETED` → no-op;
- `PENDING|IN_PROGRESS` → recovery того же checkpoint;
- `UNKNOWN` → только read-only reconciliation;
- `BLOCKED` → fail-closed, если явная policy не разрешает reevaluation.

Checkpoint ownership использует atomic claim/fencing. Lease expiry или новый controller сами по себе не доказывают прекращение предыдущего external sender.

## 7. Effect identity и request hashing

Каждый внешний side effect имеет stable `operation_id`, immutable logical slot и durable effect record до dispatch.

Effect request identity использует только versioned contract S-0011:

- `STRUCTURED_CANONICAL_JSON`; или
- `EXACT_BYTES`.

Effect record сохраняет mode, version, canonical contract ref/hash и lowercase request digest. Unknown/mismatched contract, changed payload/destination или unverifiable original bytes fail closed.

Controller restart/version change не может менять identity уже admitted effect.

## 8. Destination capability classes

Каждый effect path имеет trusted versioned destination declaration и классифицируется:

- **A — IDEMPOTENT_DESTINATION**: destination доказуемо связывает stable identity с exact payload и применяет logical effect at most once;
- **B — TRANSACTIONAL_EFFECT**: actual effect и durable completion находятся в одной atomic transaction domain;
- **C — NON_IDEMPOTENT_NON_TRANSACTIONAL**: A/B не доказаны.

Default — C.

Local lock, client marker, timeout, duplicate HTTP error или local transaction around external HTTP call не повышают destination до A/B.

Для class C любой possible dispatch без authoritative final outcome → `INDETERMINATE_EFFECT` / UNKNOWN. Automatic resend запрещён.

## 9. Dispatch episodes и recovery

Один logical effect содержит append-only numbered dispatch episodes.

Episode admission и ownership являются atomic/fenced. `SUCCEEDED` закрывает logical effect навсегда. New episode допускается только после authoritative `NO_EFFECT` предыдущего episode и только если отдельная authority/retry policy всё ещё разрешает dispatch.

Crash после durable `DISPATCHING` для A/C считается possible-effect evidence. Recovery сначала выполняет destination-specific authoritative read-only reconciliation.

Отсутствие локального receipt, временный 404, timeout или пустой search не являются доказательством NO_EFFECT.

## 10. UNKNOWN reconciliation

UNKNOWN — это fail-closed operational quarantine, а не error-to-retry shortcut.

Reconciliation:

- read-only относительно внешнего destination/provider;
- относится только к exact attempt/effect identity;
- требует authoritative provider/destination evidence;
- может записать один доказанный terminal operational outcome;
- не может создавать новый grant, новую authority, второй continuation или автоматически повторять effect.

UNKNOWN никогда не очищается TTL-ом в reusable authority.

## 11. S-0009/S-0010 integration

Independent-review work сохраняет S-0009/S-0010 как более строгий contract.

Полный `grant_id + manifest_hash + issuance_digest` проходит через TaskRequirements, routing decision, attempt, InvocationEnvelope/Receipt, grant admission, reconciliation и durable review evidence.

One-consumption semantics S-0010 имеют приоритет над generic retry semantics: даже proven NO_EFFECT или class-A destination не разрешают второй model request, если grant contract forbids retry.

Self-review и independence checks используют trusted producer/provider identity, а не model prose.

## 12. Existing Broker relationship

Slice A/B реализуются как bounded components внутри существующей Genesis Broker codebase/runtime boundary, пока implementation не докажет необходимость отдельного architectural revision.

Рекомендуемая форма:

- pure contracts/canonicalization/router modules;
- bounded durable orchestration/recovery modules;
- existing Durable Object/runtime primitives только как operational store;
- adapters отделены от core routing/governance logic.

Этот DR НЕ разрешает production route wiring, new deployment, Durable Object migration, secrets/config changes или LIVE provider calls.

Если implementation требует новый credential trust boundary, новый durable project/control-plane SoT или standing/chained consequential authority — STOP и revision/new DR до implementation.

## 13. Concurrency и crash safety

Implementation обязана доказать тестами:

- concurrent routing input permutations дают одинаковый result;
- duplicate events не создают второй continuation;
- concurrent checkpoint claims имеют одного winner;
- delayed former owner после lease expiry не может выполнить второй unsafe effect;
- initial dispatch имеет отдельный durable admission до external call;
- class A/B/C recovery следует destination contract;
- cross-controller request hashing воспроизводит exact digest;
- partial/mismatched records fail closed;
- stale GitHub HEAD/authority блокируют resumed continuation.

## 14. Failure policy

Архитектура предпочитает безопасную остановку ложному успеху.

Следующие состояния не угадываются:

- provider availability/quota/cost;
- receipt correlation;
- external effect outcome;
- grant state;
- task/PR/HEAD freshness;
- destination idempotency guarantees.

Если correctness зависит от неизвестного факта — action блокируется или переходит в UNKNOWN до authoritative evidence.

---

# Последствия

## Положительные

- единый provider-neutral path вместо provider-specific orchestration;
- безопасная замена/добавление Codex, Grok, Copilot, Jules и будущих agents через adapters;
- crash/replay safety является явным contract, а не best effort;
- GitHub SoT и CEO gates остаются неизменными;
- Slice A можно реализовать почти полностью pure/test-first;
- Slice B можно доказать deterministic crash/concurrency tests до production wiring.

## Отрицательные

- durable effect/recovery model сложнее обычного worker queue;
- class C operations могут оставаться заблокированными после crash;
- destination declarations и hashing contracts требуют versioned maintenance;
- eventual completion сознательно не гарантируется там, где at-most-once невозможно доказать.

## Риски

- ошибочная destination classification;
- stale/malformed registry provenance;
- accidental provider-specific branch in core;
- duplicate external effects при неправильном fencing;
- unsafe recovery из UNKNOWN;
- ослабление S-0010 one-consumption generic retry logic;
- превращение operational state в второй SoT.

Все перечисленные риски должны закрываться fail-closed validation и deterministic tests до production activation.

---

# Implementation sequence

После принятия этого DR и отдельной CEO Execution Authorization:

## Slice A

Pure contracts/router:

- ProviderDescriptor canonicalization/hash;
- ResourceSnapshot validation;
- TaskRequirements/authority/producer validation;
- hard filters;
- deterministic ranking/tie-break;
- routing evidence;
- fixed vectors and unit tests;
- zero network mutation.

## Slice B

Durable event/recovery contracts:

- normalized events + canonical dedupe;
- attempt state machine;
- exact receipt correlation;
- continuation checkpoints;
- effect records/episodes;
- effect hashing v1;
- A/B/C destination declarations;
- reconciliation;
- S-0010 grant tuple binding;
- crash/concurrency tests with fakes/mocks only unless later EA explicitly grants more.

Production wiring/adapters/live proof remain separate later stages/gates.

---

# Проверка решения

До CEO Acceptance этого DR требуется независимый exact-HEAD review, который проверит минимум:

- соответствие Approved S-0011 Revision 3 без scope expansion;
- отсутствие второго control plane/SoT;
- deterministic router boundary;
- A/B/C semantics;
- effect hashing/version binding;
- crash/replay/UNKNOWN correctness;
- S-0009/S-0010 precedence;
- DR-0008 сохранён без ослабления;
- реалистичность Slice A/B как bounded implementation.

Кроме того, перед CEO Acceptance DR-0012 current `main` MUST содержать Approved S-0011 Revision 3, а review DR-0012 MUST быть повторён/подтверждён на exact DR HEAD против этого canonical main artifact. Preliminary review, выполненный пока S-0011 находится только в Draft PR #122, не является достаточным acceptance evidence.

---

# Не разрешено этим DR

Даже после принятия DR сам по себе не выдаёт Execution Authorization и не разрешает:

- implementation;
- Ready/merge;
- production deploy/promotion;
- LIVE enable/toggle;
- secret/PAT mutation;
- authenticated production Broker POST;
- production model invocation;
- Dify run/publish;
- DR-0008 lift;
- automatic paid spend;
- standing/chained consequential authority.

---

# Связанные документы

- `specifications/S-0011-Genesis-Universal-Adaptive-Agent-Orchestration-v0.1.md`
- `specifications/S-0010-Genesis-Independent-Reviewer-Orchestration-v0.1.md`
- `specifications/S-0009-Genesis-Independent-Grok-Reviewer-v0.2.md`
- `decisions/DR-0005-Operational-AI-Team-Roles.md`
- `decisions/DR-0008-Broker-Token-Exposure-Quarantine.md`
- `decisions/DR-0011-Genesis-Independent-Grok-Reviewer.md`
- Issue #123

---

# История изменений

- 2026-09-11 — создан Proposed DR-0012 на основании CEO-approved S-0011 Revision 3. S-0011 остаётся в Draft PR #122; DR-0012 не может быть принят или использован как implementation prerequisite до отдельного merge S-0011 в `main` и повторной exact-HEAD проверки. Acceptance и implementation authority не выданы.
