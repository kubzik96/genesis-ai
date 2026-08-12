# S-0005 — Genesis Limited Grok Executor Path

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0005 |
| **Название** | Genesis Limited Grok Executor Path |
| **Статус** | **Approved** |
| **Revision** | 1 |
| **Автор** | ChatGPT — COO, по поручению CEO и итогам архитектурного review Grok |
| **Дата создания** | 2026-08-11 |
| **Дата утверждения** | 2026-08-11 |
| **Утвердил** | CEO Genesis AI |
| **Execution Authorization** | **GRANTED — Stage 1 CODE_AND_TESTS_ONLY** |
| **Связанные задачи** | **T-011** |
| **Связанные Decision Records** | DR-0007 (Accepted) |
| **Родительская Specification** | S-0001 Revision 3 (Approved) |
| **Исполнитель (после Authorization)** | Integration Engineer; Grok/xAI как limited executor |

> Этот документ утверждён CEO 2026-08-11.
>
> **Первоначальное Approval само по себе не являлось Execution Authorization.**
>
> Approval не разрешал реализацию, deployment, изменение secrets, live GitHub write или smoke.
>
> 2026-08-11 CEO Genesis AI выдал отдельный staged **Execution Authorization: GRANTED — Stage 1 CODE_AND_TESTS_ONLY** (см. раздел Stage 1 EA ниже).
>
> Stage 1 не разрешает deployment, secrets operations, Dify changes, live xAI calls, runtime live GitHub writes или smoke.
>
> Первый live smoke требует отдельного ограниченного CEO Gate после code/tests review и независимого review draft PR.

---

## Stage 1 EA (CODE_AND_TESTS_ONLY) — 2026-08-11

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

### Stage 1 implementation outcome — 2026-08-12

- **Task status:** T-011 = **REVIEW** (not DONE).
- **Implementation PR:** [#29](https://github.com/kubzik96/genesis-ai/pull/29), reviewed HEAD `348729a9cebe98476d00bc62c963aa4c0163efe4`.
- **Evidence:** focused endpoint tests 33/33, Durable Object tests 14/14, full Broker suite 128/128; expanded Git diff oracle — 1,985 comparisons, zero undercounts and zero accepted oversize cases.
- **Independent review:** non-Grok PASS on the exact reviewed HEAD; formal GitHub review APPROVED.
- **Post-review decisions:** CEO separately authorized Ready, Approve and squash merge. PR #29 was merged as `4c7677fcb0a84557888171c5c54cad8974e1e6be`.
- **Authorization boundary:** those post-review decisions do not expand Stage 1 EA and do not grant Stage 2, deployment, Cloudflare, Dify, secrets operations, live xAI/GitHub writes or smoke.
- **Live runtime evidence:** none; `CI_NOT_CONFIGURED`.

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

## 8. Критерии готовности

- [x] S-0005 и DR-0007 утверждены CEO и опубликованы в Git.
- [x] Отдельная Bridge task зарегистрирована.
- [x] Отдельный staged Execution Authorization выдан.
- [x] Один endpoint реализован без generic proxy/merge route.
- [ ] `XAI_API_KEY` находится только в Broker secret storage.
- [x] Все hard limits §4.4 enforced server-side.
- [x] Unit/contract/negative tests подтверждают auth, gate, base SHA, allowlist, limits и idempotency.
- [x] Partial failure переводится в `UNKNOWN` без auto-retry.
- [ ] Dify draft flow не выполняет direct GitHub write.
- [ ] Первый smoke меняет только `MEMORY.md`, 1–3 строки, в одной новой ветке и одном draft PR.
- [ ] Broker возвращает фактические Git-артефакты.
- [x] Workflow останавливается на `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW` (mocked Stage 1 contract evidence).
- [x] Grok не является sole reviewer.
- [x] Merge endpoint и direct `main` write отсутствуют в executor implementation.
- [x] Секреты отсутствуют в Git, тестовых логах и безопасных ответах Stage 1.
- [x] Результат не объявляется полным One-Window PASS до независимого автоматического review и Gate 3.

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

Открытые вопросы до следующих live/deployment stages:

1. Точный xAI model и максимальный token budget.
2. Минимальные GitHub permissions для ref/commit/draft PR в текущем credential.
3. Механизм независимого автоматического reviewer после smoke.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-08-11 | ChatGPT — COO | Создан Draft limited Grok/xAI executor path; EA NOT_GRANTED |
| 1 | 2026-08-11 | CEO Genesis AI | **Approved**. Execution Authorization остаётся NOT_GRANTED. Реализация, deployment, secrets operations и smoke не разрешены этим Approval. |
| 1 | 2026-08-11 | CEO Genesis AI | granted Stage 1 CODE_AND_TESTS_ONLY EA for T-011; source + local unit/contract/negative/mock tests + docs only; feature branch + draft PR; deployment, secrets, live xAI/GitHub writes и smoke запрещены. |
| 1 | 2026-08-12 | ChatGPT — independent reviewer | PR #29 independently reviewed PASS on exact HEAD `348729a…`; Stage 1 code/tests criteria confirmed. |
| 1 | 2026-08-12 | CEO Genesis AI | Separately authorized Ready, formal Approve and squash merge (`4c7677f…`). T-011 → REVIEW; Stage 2/runtime authorization remains NOT_GRANTED. |
