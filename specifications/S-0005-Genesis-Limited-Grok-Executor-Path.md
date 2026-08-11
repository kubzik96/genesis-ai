# S-0005 — Genesis Limited Grok Executor Path

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0005 |
| **Название** | Genesis Limited Grok Executor Path |
| **Статус** | Draft |
| **Revision** | 1 |
| **Автор** | ChatGPT — COO, по поручению CEO и итогам архитектурного review Grok |
| **Дата создания** | 2026-08-11 |
| **Дата утверждения** | — |
| **Утвердил** | — |
| **Execution Authorization** | NOT_GRANTED |
| **Связанные задачи** | Новая задача — NOT_REGISTERED |
| **Связанные Decision Records** | DR-0007 (Proposed) |
| **Родительская Specification** | S-0001 Revision 3 Draft; до Approval действует S-0001 Revision 2 |
| **Исполнитель (после Authorization)** | Integration Engineer; Grok/xAI как limited executor |

> Этот Draft не разрешает реализацию, deployment, изменение secrets или live GitHub write.
>
> Approval этой Specification не является Execution Authorization.
>
> Первый live smoke требует отдельного ограниченного CEO Gate после code/tests/deploy-readonly review.

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
- Перенос уже существующего xAI key в Broker является отдельной secret operation и не разрешён этим Draft.

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

- S-0001 Revision 3 — после отдельного CEO Approval;
- DR-0007 — после отдельного CEO Approval;
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

- [ ] S-0005 и DR-0007 утверждены CEO и опубликованы в Git.
- [ ] Отдельная Bridge task зарегистрирована.
- [ ] Отдельный staged Execution Authorization выдан.
- [ ] Один endpoint реализован без generic proxy/merge route.
- [ ] `XAI_API_KEY` находится только в Broker secret storage.
- [ ] Все hard limits §4.4 enforced server-side.
- [ ] Unit/contract/negative tests подтверждают auth, gate, base SHA, allowlist, limits и idempotency.
- [ ] Partial failure переводится в `UNKNOWN` без auto-retry.
- [ ] Dify draft flow не выполняет direct GitHub write.
- [ ] Первый smoke меняет только `MEMORY.md`, 1–3 строки, в одной новой ветке и одном draft PR.
- [ ] Broker возвращает фактические Git-артефакты.
- [ ] Workflow останавливается на `DRAFT_PR_CREATED_AWAITING_INDEPENDENT_REVIEW`.
- [ ] Grok не является sole reviewer.
- [ ] Merge и direct `main` write отсутствуют.
- [ ] Секреты отсутствуют в Git, логах и безопасных ответах.
- [ ] Результат не объявляется полным One-Window PASS до независимого автоматического review и Gate 3.

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

Открытые вопросы до Approval:

1. Точный xAI model и максимальный token budget.
2. Минимальные GitHub permissions для ref/commit/draft PR в текущем credential.
3. Механизм независимого автоматического reviewer после smoke.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-08-11 | ChatGPT — COO | Создан Draft limited Grok/xAI executor path; EA NOT_GRANTED |
