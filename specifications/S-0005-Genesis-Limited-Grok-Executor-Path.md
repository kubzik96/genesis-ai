# S-0005 — Genesis Limited Grok Executor Path

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0005 |
| **Название** | Genesis Limited Grok Executor Path |
| **Статус** | **Approved** |
| **Revision** | 2 |
| **Автор** | ChatGPT — COO, по поручению CEO и итогам архитектурного review Grok |
| **Дата создания** | 2026-08-11; candidate Revision 2 — 2026-08-12 |
| **Дата утверждения** | Revision 1 — 2026-08-11; Revision 2 — 2026-08-12 |
| **Утвердил** | Revision 1 — CEO Genesis AI; Revision 2 — CEO Genesis AI |
| **Execution Authorization** | **NOT_GRANTED — Revision 2 Approved; Stage 2 требует отдельного CEO EA** |
| **Связанные задачи** | **T-011** |
| **Связанные Decision Records** | DR-0007 (Accepted) |
| **Родительская Specification** | S-0001 Revision 3 (Approved) |
| **Исполнитель (после Authorization)** | Integration Engineer; Grok/xAI как limited executor |

> **Revision 2 — Approved** CEO Genesis AI 2026-08-12 на основании self-review, явно принятого CEO после недоступности Grok из-за лимита.
>
> Revision 1 и выданная для неё Stage 1 EA остаются историческим основанием уже выполненной Stage 1.
>
> **PROMOTION COMPLETE / PRE-MERGE GATE:** этот promotion commit атомарно переводит S-0005 и `specifications/INDEX.md` в Approved Revision 2 и удаляет proposal-запись. Его exact HEAD является review-only и **MUST NOT MERGE** до финальной read-only проверки и отдельных CEO решений Ready/Merge.
>
> Approval и promotion commit не разрешают Stage 2 implementation. Execution Authorization остаётся отдельным последующим Gate.
>
> Этот Approval не разрешает код, deployment, Cloudflare, secrets, Dify, live xAI/GitHub calls или smoke.
>
> Любая реализация Revision 2 требует отдельный staged Execution Authorization.
>
> Первый live smoke по-прежнему требует отдельного ограниченного CEO Gate после code/tests review, deployment preflight и проверки точного deployed SHA.

---

## Stage 1 EA (CODE_AND_TESTS_ONLY) — история Revision 1

**Status:** GRANTED by CEO Genesis AI 2026-08-11 for Bridge task **T-011**.

### Разрешено Stage 1

- source code для одного composite endpoint `POST /v1/executions/grok/draft-pr`;
- local unit / contract / negative / mock tests;
- docs в разрешённых путях;
- feature branch + implementation commits + **draft PR** — разрешены авторизованному GitHub-исполнителю (чат Grok) как артефакты разработки;
- только **mocked** xAI и **mocked** GitHub integrations (runtime path).

### Разрешённые пути Stage 1

- `services/genesis-broker/`
- `services/genesis-broker/tests/`
- `docs/genesis-broker/`

### Запрещено этим Stage 1 EA

- deployment;
- Cloudflare changes;
- secrets operations (включая перенос `XAI_API_KEY`);
- Dify changes;
- live xAI calls;
- runtime live GitHub writes: новый Broker endpoint, xAI-модель и Dify **не** выполняют live GitHub writes на Stage 1;
- smoke любого вида;
- direct `main`, merge, auto-merge;
- ослабление hard limits Revision 1 (§4.4).

### Завершение Stage 1

Stage 1 заканчивается на **draft PR**, ожидающем независимого (non-Grok) review. Дальнейшие stages требуют **отдельного** CEO Authorization.

Hard limits Revision 1 **не** ослаблены этим EA.

### Фактический итог Stage 1

- implementation PR [#29](https://github.com/kubzik96/genesis-ai/pull/29) независимо проверен на HEAD `348729a9cebe98476d00bc62c963aa4c0163efe4`;
- focused tests 33/33, Durable Object tests 14/14, полный Broker suite 128/128;
- PR #29 объединён отдельным CEO Merge Authorization; squash в `main`: `4c7677fcb0a84557888171c5c54cad8974e1e6be`;
- SoR sync PR #31 объединён как `906c48767bab4d14b217dfd6366afa92d313e197`;
- T-011 остаётся **REVIEW**, не DONE;
- live xAI, runtime GitHub write через новый endpoint, deployment, Dify changes, secrets operations и smoke не выполнялись.

---

## Candidate Stage 2 — PRODUCTION_ADAPTER_CODE_AND_TESTS_ONLY

**Status:** `NOT_AUTHORIZED`. Этот раздел является предложением Draft Revision 2.

### Цель Stage 2

Заменить Stage 1 mock-only runtime guard на production-capable, но **default-off** adapters для xAI и уже ограниченного GitHub client, сохранив все hard limits и не выполняя deployment или live calls.

### Разрешаемый scope только после будущего Stage 2 EA

- `services/genesis-broker/src/` — xAI client, production adapter wiring, fail-closed feature flag и cost ledger;
- `services/genesis-broker/tests/` — unit, contract, negative, budget, timeout, recovery и captured-fixture tests без live API;
- `docs/genesis-broker/` — model contract, permissions, deployment preflight, secrets placement и rollback;
- `services/genesis-broker/wrangler.toml` — только несекретное объявление default-off binding, если оно необходимо; значение activation flag не включается.

### Запрещено Stage 2

- deployment и изменение Cloudflare Worker;
- создание, перенос, чтение, вывод или ротация secrets;
- изменение Dify;
- live xAI request, live GitHub write или smoke;
- включение production feature flag в любом environment;
- Ready/merge реализации без independent review и отдельных CEO решений;
- Grok Bot, Grok Build, desktop/cloud computer, MCP tools, web/X search, code execution или function tools в runtime executor path.

### Результат Stage 2

Отдельный Draft PR с code/tests/docs. Даже после merge production endpoint остаётся fail-closed до отдельного deployment/secrets/live Authorization.

### Дальнейшие gates (не авторизованы Revision 2 Draft)

1. deployment reviewed SHA с executor flag `false`;
2. отдельная secret/permission operation и read-only health/preflight;
3. Dify draft wiring без публикации;
4. отдельный Gate на один live smoke;
5. independent review фактического smoke PR; merge smoke PR находится вне Broker и требует отдельного CEO Gate.

---

## 1. Контекст

Цель Genesis One-Window — дать CEO одну точку управления без ручного копирования команд между ChatGPT, Grok, Copilot и GitHub.

Copilot-путь S-0001 завершился `PARTIAL PASS`: GitHub Copilot Free не предоставляет нужный Cloud Agent path. При этом у CEO уже оплачен xAI API, поэтому Grok можно подключить программно вместо ручной передачи сообщений между окнами.

Текущий Genesis Broker умеет создавать Issue, назначать Copilot и читать Issue/PR/diff. Он не умеет вызывать xAI, создавать ветку, commit или draft PR. Эти полномочия нельзя добавить молча в S-0002 Revision 1.

S-0005 определяет отдельный минимальный и fail-closed путь:

```text
CEO в Dify → Broker → Grok/xAI → Broker validation → новая ветка → commit → draft PR → STOP
```

Grok выступает ограниченным executor. Он не получает GitHub credentials и не может быть единственным reviewer собственного результата.

---

## 2. Цель

После одной команды CEO в Dify и отдельного Gate 2 Broker должен:

1. загрузить разрешённый контекст из актуального `main`;
2. вызвать Grok через xAI API без ручного копирования CEO;
3. получить строго структурированное предложение изменения;
4. проверить repo, base SHA, путь, размер и содержание изменения;
5. создать новую ветку, один commit и один draft PR;
6. вернуть безопасные Git-артефакты в Dify;
7. остановиться со статусом `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW`.

Merge, auto-merge и самостоятельное утверждение Grok отсутствуют.

---

## 3. Scope

### Разрешено изменять после отдельного Execution Authorization

- `services/genesis-broker/` — один новый endpoint и необходимые internal modules;
- `services/genesis-broker/tests/` — unit, contract, mocked integration и negative tests;
- `docs/genesis-broker/` — контракт, secrets, deployment, reconciliation и teardown;
- Dify workflow draft — только после готового и проверенного Broker-контракта;
- первый live smoke — только после отдельного CEO Gate.

### Запрещено

- direct GitHub write из Dify или Grok;
- передача `GITHUB_PAT`, `XAI_API_KEY` или `BROKER_SERVICE_TOKEN` модели;
- запись в `main`;
- force-push;
- merge или auto-merge;
- Ready-for-review PR: создаётся только draft PR;
- изменение или удаление существующих веток;
- generic GitHub proxy;
- произвольные repositories, paths или base branches;
- бинарные файлы;
- более одного файла в Revision 1;
- автоматический retry после неопределённого upstream write;
- Grok как sole independent reviewer собственной реализации;
- изменение Constitution, DR-0005 или S-0002 без отдельного решения.

---

## 4. Требования

### 4.1 Единственный write-contract

Новый публичный endpoint Broker:

```text
POST /v1/executions/grok/draft-pr
operation = create_branch_commit_draft_pr
```

Обязательные headers:

- `Authorization: Bearer <BROKER_SERVICE_TOKEN>`;
- `Idempotency-Key: <unique key>`.

Минимальное тело:

```json
{
  "run_id": "unique-run-id",
  "gate": "G2",
  "confirmed_at": "ISO-8601",
  "base_sha": "40-char commit SHA",
  "task": {
    "title": "bounded task",
    "instruction": "exact requested change",
    "allowed_files": ["MEMORY.md"]
  }
}
```

Repository, base branch, branch prefix и hard limits задаются Broker, а не клиентом.

### 4.2 Последовательность операции

Broker обязан выполнить операцию в следующем порядке:

1. проверить service auth, Gate TTL, rate limit и idempotency;
2. получить фактический SHA `main` и сравнить с `base_sha`;
3. при несовпадении вернуть `409 BASE_SHA_MISMATCH` без xAI/GitHub write;
4. загрузить только allowlisted context;
5. вызвать xAI и потребовать ответ по закрытой JSON-schema;
6. проверить, что ответ меняет только разрешённые файлы и проходит hard limits;
7. повторно убедиться, что `main` всё ещё равен `base_sha`;
8. создать новую ветку от точного `base_sha`;
9. создать один atomic commit;
10. создать один draft PR в `main`;
11. сохранить safe result в authoritative idempotency store;
12. вернуть PR number, URL, branch, base SHA, head SHA, changed files и безопасный статус;
13. остановить workflow до independent review.

### 4.3 Структурированный ответ Grok

Grok возвращает данные, но не выполняет GitHub write. Ответ должен содержать:

- краткое объяснение изменения;
- ровно один элемент `changes`;
- path из allowlist;
- ожидаемый исходный blob SHA;
- новый UTF-8 text content;
- отсутствие binary/base64 payload;
- self-check о соблюдении scope.

Любое неизвестное поле, второй файл, несовпадающий blob SHA или невалидный JSON → reject без GitHub write.

### 4.4 Hard limits Revision 1

| Ограничение | Значение |
|---|---|
| Repository | только `kubzik96/genesis-ai` |
| Base branch | только `main` |
| Base SHA | точное совпадение с актуальным `main` до и после xAI call |
| Branch | только новая `genesis/grok/<run-id>` |
| Files | максимум 1 |
| Allowed file для smoke | только `MEMORY.md` |
| Changed lines | максимум 3 суммарно (additions + deletions) |
| Unified diff size | максимум 2 KiB |
| File type | только UTF-8 text; binary запрещён |
| Commits | ровно 1 |
| Pull request | ровно 1, обязательно draft |
| Writes per run | максимум 1 успешная composite operation |
| Merge | endpoint отсутствует |

Расширение этих лимитов требует новой Revision S-0005 и нового CEO Approval.

### 4.5 Secrets

- `XAI_API_KEY` хранится только в Broker/Cloudflare Worker Secret.
- `GITHUB_PAT` и `BROKER_SERVICE_TOKEN` сохраняют действующие правила S-0002.
- Dify не хранит `XAI_API_KEY` для executor path.
- Grok получает задачу и allowlisted context, но не получает GitHub credentials или service token.
- Secrets запрещены в request/response body, audit, logs, Git, Issue, commit и PR.
- Перенос уже существующего xAI key в Broker является отдельной secret operation и не разрешён Stage 1 EA.

### 4.6 Idempotency и partial failure

- `run_id` и `Idempotency-Key` уникальны.
- Тот же key + тот же canonical request возвращает сохранённый safe result без нового xAI/GitHub write.
- Тот же key + другой request → `409 IDEMPOTENCY_CONFLICT`.
- После создания ветки, commit или PR любой timeout/неопределённость → `UNKNOWN` и `BLOCKED_RECONCILIATION_REQUIRED`.
- Автоматический retry composite write запрещён.
- Reconciliation выполняется сначала только чтением фактических GitHub refs/commits/PR.
- Новый write после `UNKNOWN` требует отдельного решения CEO.

### 4.7 Independent review и CEO Gates

| Gate | Момент |
|---|---|
| Gate 1 | Перед фиксацией точного smoke scope и задания |
| Gate 2 | Перед `POST /v1/executions/grok/draft-pr` |
| Gate 3 | После independent review фактического diff |
| Gate 4 | Перед merge; merge находится вне S-0005 |

Для Revision 1:

- Grok не review собственный diff как sole reviewer;
- ChatGPT или другой не-Grok reviewer проверяет фактический PR diff;
- пока независимый reviewer не подключён через API, первый smoke завершается на `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW`;
- такой smoke подтверждает executor path, но **не** полный One-Window acceptance criterion без ручных переходов;
- CEO Gate не заменяет independent technical review.

### 4.8 xAI production contract (candidate Revision 2)

| Поле | Значение |
|---|---|
| API | `POST https://api.x.ai/v1/chat/completions` |
| Model | точный ID `grok-4.3`; aliases `-latest` / `grok-latest` запрещены |
| Response | `response_format.type=json_schema`, closed schema, `additionalProperties=false` |
| Reasoning | `low` |
| Tools | отсутствуют; function/web/X/code/MCP tools запрещены |
| Streaming | `false` |
| Requests per operation | ровно 1 |
| Automatic retry | 0 |
| Output ceiling | 8,192 tokens |
| Live source ceiling | 6 KiB UTF-8 и 4,096 строк, даже если общий Stage 1 validator допускает больше |
| Total serialized request ceiling | 32 KiB UTF-8, включая instructions, source и JSON schema |
| Timeout | 45 seconds end-to-end for xAI call |
| Model fallback | отсутствует; недоступность точного model ID → fail-closed |

Выбор `grok-4.3` основан на наличии structured outputs и более низкой стоимости для малого bounded edit. Переход на другую модель, включая `grok-4.6`, требует новой Revision или явно утверждённого изменения этой Revision.

После ответа Broker повторно валидирует JSON обычным кодом; гарантия provider schema не заменяет server-side validation S-0005.

Путь Chat Completions находится в разделе `legacy` документации xAI. Перед любым будущим Stage 2 EA его доступность и совместимость повторно проверяются read-only. Недоступность или объявление срока отключения не разрешают автоматическую миграцию на Responses API: endpoint остаётся fail-closed до отдельного изменения Specification и review.

### 4.9 Budget contract (candidate Revision 2)

- calendar month и accounting timezone: UTC;
- candidate hard monthly ceiling: **USD 5.00** для этого endpoint;
- до xAI-вызова Durable Object атомарно резервирует **USD 0.10** (`1,000,000,000` USD ticks) на единственный запрос;
- если доступный месячный остаток меньше reservation, вернуть `429 XAI_BUDGET_EXCEEDED` без xAI/GitHub write;
- после валидного ответа reservation заменяется фактическим total provider cost из `usage.cost_in_usd_ticks` xAI response;
- reasoning tokens не вычитаются и не учитываются отдельным обходным каналом: любые их charges входят в authoritative total provider cost и budget settlement;
- отсутствующий, нецелый или отрицательный cost → fail-closed, reservation остаётся полностью списанным, live path блокируется до reconciliation, GitHub write не выполняется;
- cost выше reservation → ledger записывает фактический cost, даже если месячный счётчик временно превысит ceiling; live path блокируется до reconciliation, GitHub write не выполняется;
- prompt/context формируется в пределах фиксированного byte ceiling до network call;
- при текущих опубликованных тарифах `grok-4.3` worst-case для 32 KiB input и 8,192 output tokens не превышает USD 0.062; reservation USD 0.10 обязателен с запасом;
- priority processing, server-side tools, batch/deferred calls и prompt caching не используются в первом live path;
- цены и доступность модели повторно проверяются read-only непосредственно перед будущим Approval/EA; рост цены выше reservation блокирует activation до новой Revision.

### 4.10 GitHub production permissions и activation

Для fixed repository `kubzik96/genesis-ai` credential будущего live executor требует только:

- Metadata: read (implicit);
- Contents: read and write — чтение SHA/content, создание новой ref и один commit;
- Pull requests: read and write — создание одного Draft PR.

Запрещены: Actions, Administration, Workflows, Secrets, Environments и organization-wide access. Broker client не реализует merge/delete/force-push/generic request methods. Хотя Contents write является сильным ambient permission, единственной доступной публичной операцией остаётся fixed composite endpoint с Gate, idempotency и hard limits.

Production adapter активируется только при одновременном выполнении всех условий:

1. exact deployed SHA входит в отдельно утверждённый список;
2. `GROK_EXECUTOR_LIVE_ENABLED=true` установлен отдельной authorized operation;
3. `XAI_API_KEY`, `GITHUB_PAT`, `BROKER_SERVICE_TOKEN` доступны только как Worker Secrets;
4. Durable Object и budget ledger доступны;
5. model ID, schema hash и hard-limit config совпадают с reviewed build constants.

Любое несовпадение → `503 EXECUTOR_DISABLED`, без xAI/GitHub call.

### 4.11 Grok on computer boundary

Официальные Grok Bot и Grok Build действительно могут работать через desktop/CLI и persistent cloud computer. Они **не являются** runtime dependency или заменой xAI API в Revision 2:

- их browser/terminal/app permissions шире fixed Broker contract;
- persistent sign-in sessions создают второй credential boundary;
- самостоятельные tool calls и long-running routines противоречат bounded one-call executor path;
- их возможное использование как task-scoped engineer/reviewer требует отдельного DR/Specification/EA и не считается One-Window acceptance evidence.

---

## 5. Ограничения

- xAI API уже оплачен и является единственным доступным платным model API на текущем этапе.
- ChatGPT Plus не является OpenAI API и не вызывается Broker/Dify автоматически.
- S-0005 не назначает Grok постоянным автономным control plane.
- Broker остаётся единственной GitHub write boundary.
- GitHub остаётся System of Record.
- T-006 остаётся BLOCKED.

---

## 6. Dependencies

- S-0001 Revision 3 — **Approved**;
- DR-0007 — **Accepted**;
- S-0002 Revision 1 — существующие auth/idempotency/audit foundations, без молчаливого расширения его allowlist;
- действующий Genesis Broker deployment;
- xAI API balance и `XAI_API_KEY`;
- GitHub credential с минимальными Contents/Pull requests permissions;
- отдельная зарегистрированная Bridge task;
- независимый не-Grok reviewer для Gate 3.

---

## 7. Assumptions

- xAI API поддерживает требуемый структурированный ответ в пределах бюджета;
- GitHub API позволяет создать ref, commit и draft PR с используемым credential;
- `MEMORY.md` остаётся допустимым безопасным smoke-файлом;
- Dify сохраняет HITL Gate без автоматического подтверждения.

---

## 8. Критерии готовности Revision 2

### 8.1 Approval, promotion и pre-merge verification

- [x] Exact Draft HEAD прошёл self-review; CEO явно принял self-review как основание Approval после недоступности Grok из-за лимита.
- [x] CEO отдельно утвердил Revision 2; сам Approval не разрешает implementation/deploy/secrets/live calls/smoke.
- [x] Создан один promotion commit: S-0005 metadata → Approved Revision 2; authoritative INDEX row → Approved Revision 2; proposal entry удалена.
- [ ] Exact promotion HEAD прошёл финальную read-only проверку path/status/EA/scope до отдельных Ready/Merge решений.
- [ ] До финальной проверки и отдельных CEO решений PR остаётся Draft и merge запрещён.

### 8.2 Для будущего Stage 2 CODE_AND_TESTS_ONLY

- [ ] Выдан отдельный exact-scope EA на source/tests/docs в feature branch и Draft PR.
- [ ] Реализован default-off production adapter без generic proxy/merge route.
- [ ] Все hard limits §§4.4, 4.8–4.10 enforced server-side.
- [ ] Budget reservation/settlement атомарны и покрыты unit/contract/negative tests.
- [ ] Тесты подтверждают точный model ID, closed JSON schema, one-call/no-retry и fail-closed activation.
- [ ] GitHub client технически не предоставляет merge/delete/force-push/generic request methods.
- [ ] Секреты, deployment bindings, Dify wiring и live network calls отсутствуют в Stage 2 diff.
- [ ] Feature flag остаётся выключенным; без всех activation conditions endpoint возвращает `503` до xAI/GitHub call.

### 8.3 Для будущих operational stages

- [ ] Reviewed exact SHA deployed с live flag `false` по отдельному EA.
- [ ] Secrets/minimal GitHub permissions установлены отдельной authorized operation и проверены read-only.
- [ ] Dify draft flow подготовлен, но не опубликован, по отдельному EA.
- [ ] Один live smoke отдельно разрешён и меняет только `MEMORY.md`, 1–3 строки, в одной новой ветке и одном Draft PR.
- [ ] Broker возвращает фактические Git-артефакты и останавливается на `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW`.
- [ ] Независимый reviewer проверил фактический smoke diff; Grok не является sole reviewer.
- [ ] Merge и direct `main` write отсутствуют до отдельного CEO Gate.
- [ ] Результат не объявляется полным One-Window PASS до независимого review и Gate 3.

---

## 9. Способы проверки

1. Static review endpoint/allowlist: нет merge, delete, force-push, generic proxy или other-repo paths.
2. Unit tests схемы Grok response и hard limits.
3. Mocked xAI/GitHub contract tests для happy path.
4. Negative tests: stale base SHA, malformed JSON, second file, >3 lines, >2 KiB, binary, existing branch, duplicate run, expired Gate, unauthorized path.
5. Recovery tests: timeout после ref/commit/PR → `UNKNOWN`, no auto-retry, read-only reconciliation.
6. Secret scan исходников, fixtures, logs и экспортируемой Dify-конфигурации.
7. Deployment binding к точному reviewed commit SHA.
8. Один отдельно разрешённый live smoke; read-only проверка фактического draft PR/diff.

---

## 10. Ожидаемые выходные артефакты

- Broker source/tests/docs для одного composite endpoint;
- Dify draft flow без секретов;
- safe smoke evidence: run id, base/head SHA, branch, draft PR URL, changed file и diff summary;
- independent review фактического diff;
- отчёт CEO с честным статусом executor-path и оставшимся блокером полного One-Window.

---

## 11. Необходимость Decision Record

- [x] Требуется DR-0007 — Grok как limited executor через Broker.

---

## 12. Риски и открытые вопросы

| Риск | Митигация |
|---|---|
| Grok совмещает Architect и executor | Явный task-scoped role; не sole reviewer |
| Модель предлагает лишние изменения | Server-side schema, allowlist и hard limits |
| Stale `main` во время xAI call | Проверка base SHA до и после model call |
| Частично созданная ветка/commit/PR | `UNKNOWN`, no retry, read-only reconciliation |
| Утечка xAI/GitHub secrets | Только Broker secrets, redaction и secret scan |
| Broker становится вторым control plane | Только один composite endpoint; no generic proxy/merge |
| Smoke ошибочно объявлен полным One-Window PASS | Отдельный статус awaiting independent review |
| Бюджет xAI | Model/token hard limits и fail-closed budget ceiling |

Решения, зафиксированные candidate Revision 2:

1. Точный xAI model: `grok-4.3`; aliases и fallback запрещены.
2. Лимиты: 32 KiB total request, 8,192 output tokens, USD 0.10 reservation, USD 5.00 monthly ceiling.
3. GitHub permissions: fixed-repository Metadata read, Contents read/write, Pull requests read/write; прочие permissions запрещены.
4. Независимый reviewer после smoke остаётся обязательным будущим Gate; конкретный automation adapter не входит в Stage 2.

### Проверенные внешние основания Revision 2

- xAI structured outputs: <https://docs.x.ai/developers/model-capabilities/text/structured-outputs>
- xAI `grok-4.3` model card и тарифы: <https://docs.x.ai/developers/models/grok-4.3>
- xAI cost tracking и USD ticks: <https://docs.x.ai/developers/cost-tracking>
- xAI rate limits: <https://docs.x.ai/developers/rate-limits>
- xAI Chat Completions endpoint: <https://docs.x.ai/developers/model-capabilities/legacy/chat-completions>
- GitHub refs permissions: <https://docs.github.com/en/rest/git/refs>
- GitHub contents permissions: <https://docs.github.com/en/rest/repos/contents>
- GitHub pull request permissions: <https://docs.github.com/en/rest/pulls/pulls>
- Grok Bot computer/app boundary: <https://docs.x.ai/grok-bot/computer-and-apps>
- Grok Build boundary: <https://docs.x.ai/build/overview>

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-08-11 | ChatGPT — COO | Создан Draft limited Grok/xAI executor path; EA NOT_GRANTED |
| 1 | 2026-08-11 | CEO Genesis AI | **Approved**. Execution Authorization остаётся NOT_GRANTED. Реализация, deployment, secrets operations и smoke не разрешены этим Approval. |
| 1 | 2026-08-11 | CEO Genesis AI | granted Stage 1 CODE_AND_TESTS_ONLY EA for T-011; source + local unit/contract/negative/mock tests + docs only; feature branch + draft PR; deployment, secrets, live xAI/GitHub writes и smoke запрещены. |
| 1 | 2026-08-12 | Codex | Stage 1 outcome recorded: PR #29 merged as `4c7677f`; PR #31 SoR sync merged as `906c487`; T-011 remains REVIEW, not DONE. |
| 2 | 2026-08-12 | Codex | Candidate Stage 2 Draft: pinned xAI/GitHub production contract, budget/permission/activation gates and future staged sequence; no EA, implementation, deploy, secrets, Dify or live calls. |
| 2 | 2026-08-12 | Codex | Independent-review corrections: Approved R1 authority preserved in INDEX; Draft R2 listed separately; reasoning-cost settlement and legacy Chat Completions migration gate clarified. |
| 2 | 2026-08-12 | Codex | Independent-review lifecycle correction: Draft HEAD made explicitly non-mergeable; atomic post-Approval promotion commit and final exact-HEAD verification required before Ready/Merge. |
| 2 | 2026-08-12 | CEO Genesis AI / Codex | **Approved** на основании self-review, принятого CEO после лимита Grok; atomic promotion выполнен. Stage 2 EA остаётся NOT_GRANTED; promotion HEAD требует финальной read-only проверки перед отдельными Ready/Merge решениями. |
