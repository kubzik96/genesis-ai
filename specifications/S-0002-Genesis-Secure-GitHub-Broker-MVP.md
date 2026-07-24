# S-0002 — Genesis Secure GitHub Broker MVP

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0002 |
| **Название** | Genesis Secure GitHub Broker MVP |
| **Статус** | Approved |
| **Revision** | 1 |
| **Автор** | Grok — Chief Architect |
| **Дата создания** | 2026-07-24 |
| **Дата утверждения** | 2026-07-24 |
| **Утвердил** | CEO Genesis AI |
| **Execution Authorization** | NOT_GRANTED |
| **Связанные задачи** | T-010 — Genesis Secure GitHub Broker MVP |
| **Родительская Specification** | S-0001 Revision 1 |
| **Связанные Decision Records** | DR-0004 |
| **Исполнитель (после Authorization)** | Integration Engineer |

> `Дата утверждения` и `Утвердил` заполняются **только после** отдельного CEO Approval.  
> `Execution Authorization` по умолчанию `NOT_GRANTED` и меняется на `GRANTED` только отдельным решением CEO.  
> Approval спецификации **не** означает разрешение на реализацию.

---

## 1. Контекст

S-0001 (Genesis One-Window Execution Spike) описывает end-to-end цикл «CEO → Issue → Copilot PR → review → decision» в одном окне Dify.

S-0001 **не** разрешает создание и хранение исходного кода отдельного Broker-сервиса.

Принятый security path:

**SECURITY PATH B2 — BROKER + COPILOT ISSUE ASSIGNMENT API**

Причина: CEO использует GitHub Copilot **Pro**. Agent Tasks API (`POST /agents/repos/.../tasks`) доступен только для Copilot Business / Enterprise и поэтому **не** используется.

Broker — новый значимый компонент:

- отдельный исходный код;
- внешний deployment;
- GitHub write-credentials (fine-grained PAT);
- security boundary между Dify и GitHub;
- audit и **authoritative** idempotency;
- новая operational dependency.

Поэтому Broker оформляется **отдельной** Specification (S-0002) и отдельной задачей (T-010).

Проблема, которую решает S-0002: нельзя безопасно хранить GitHub write-token в Dify Cloud; нужен минимальный проверяемый сервис, который держит PAT, enforce allowlist и предоставляет S-0001 безопасный путь Issue → Copilot → PR observation.

---

## 2. Цель

Создать минимальный проверяемый Broker между Dify и GitHub, который:

1. хранит GitHub PAT **вне** Dify;
2. работает **только** с репозиторием `kubzik96/genesis-ai`;
3. выполняет **только** allowlisted операции;
4. **не** имеет merge, push, delete или generic proxy;
5. сериализует write-операции и обеспечивает strongly consistent idempotency;
6. предоставляет S-0001 безопасный путь:
   - чтение approved context;
   - создание структурированного Issue;
   - назначение `copilot-swe-agent[bot]`;
   - чтение PR metadata, changed files, diff, mergeability и CI/status.

---

## 3. Scope

### В Scope (разрешено)

- Worker source code (Cloudflare Workers);
- **SQLite-backed Cloudflare Durable Object** как authoritative store для idempotency / replay / write serialization;
- конфигурация deployment **без** секретов;
- unit tests;
- mocked GitHub API tests;
- negative tests (idempotency conflict, rate limit, UNKNOWN, gate TTL);
- строгая repository/operation allowlist;
- service authentication (`BROKER_SERVICE_TOKEN`);
- rate limits и per-`run_id` ограничения;
- TTL и replay protection;
- audit log с redaction секретов;
- endpoints (см. §4.3);
- документация:
  - deployment;
  - secrets;
  - rotation;
  - revoke;
  - teardown;
- fail-closed поведение (отсутствие Durable Object binding / PAT → fail-fast / BLOCKED).

### Вне Scope (запрещено)

- Dify workflow;
- xAI review;
- OpenAI;
- auto-merge;
- любой merge endpoint;
- direct push;
- удаление веток;
- изменение GitHub settings;
- изменение secrets через API;
- generic GitHub API proxy;
- другие репозитории;
- webhooks;
- несколько пользователей;
- production-grade масштабирование;
- отдельный UI;
- разблокировка T-006;
- создание dummy Issue / лишнего PR до утверждённого сценария S-0001;
- **Workers KV как authoritative idempotency/replay store** (для MVP KV **не используется**).

### Разрешённые пути исходного кода (после Execution Authorization)

В репозитории **нет** существующей структуры `services/` или `docs/`. Зафиксированные пути:

```text
services/genesis-broker/
docs/genesis-broker/
```

Допускаются только файлы, необходимые для Worker, Durable Object, тестов и документации без секретов.

### Запрещено изменять при реализации S-0002

- `governance/Constitution.md`;
- действующие Decision Records без отдельного DR;
- `bridge/*` (кроме косвенного read через allowlist context);
- статус T-006 (остаётся BLOCKED);
- S-0001 (родительская spec не переписывается);
- `main` напрямую.

---

## 4. Требования

### 4.1 Платформа MVP

1. **Cloudflare Workers** — целевая runtime-платформа.
2. **Workers Secrets** — хранение `GITHUB_PAT`, `BROKER_SERVICE_TOKEN`.
3. **SQLite-backed Cloudflare Durable Object** — **authoritative** idempotency / replay / write serialization store:
   - все write-операции для `kubzik96/genesis-ai` проходят через **один** определённый Durable Object;
   - Durable Object **сериализует** конкурирующие write-запросы;
   - idempotency records хранятся в его **transactional, strongly consistent** storage;
   - Workers KV **не** используется для correctness / idempotency;
   - для MVP Workers KV **исключается полностью** (не optional cache);
   - отсутствие Durable Object binding / storage → write endpoints **fail-closed / BLOCKED**.
4. HTTPS из коробки.
5. Возможность **полного** удаления сервиса (teardown).
6. Исходный код и конфигурация **без** секретов хранятся в GitHub.
7. Deployment соответствует проверенному commit SHA.

### 4.2 GitHub credentials (Copilot Pro / Issue Assignment API)

8. Используется **fine-grained PAT** (user token).
9. Repository access: **только** `kubzik96/genesis-ai`.
10. Срок действия: минимальный для spike (7–30 дней).
11. Permissions:

| Permission | Access |
|---|---|
| Metadata | Read |
| Actions | Read & Write |
| Contents | Read & Write |
| Issues | Read & Write |
| Pull requests | Read & Write |

12. PAT хранится **только** в Worker Secret.
13. PAT **запрещено**:
    - хранить в Dify;
    - передавать LLM;
    - коммитить;
    - выводить в audit;
    - возвращать из API;
    - помещать в Issue или PR.

### 4.3 API endpoints

База: `https://<broker-host>/v1`  
Auth: `Authorization: Bearer <BROKER_SERVICE_TOKEN>`  
Write headers: `Idempotency-Key`; тело: `run_id`, `gate`, `confirmed_at`.

| Method | Path | Gate | Назначение |
|---|---|---|---|
| `GET` | `/v1/health` | — | liveness; fail-fast если нет PAT / Durable Object |
| `POST` | `/v1/context/read` | — | read-only approved context paths |
| `POST` | `/v1/issues` | G1 | create structured Issue |
| `POST` | `/v1/issues/{number}/assign-copilot` | G2 | assign `copilot-swe-agent[bot]` + `agent_assignment` |
| `GET` | `/v1/issues/{number}/status` | — | issue assignees + linked hints |
| `GET` | `/v1/pulls/{number}` | — | PR metadata, mergeability, CI |
| `GET` | `/v1/pulls/{number}/diff` | — | changed files + unified diff |

**Жёстко зафиксировано:**

- `repository` = `kubzik96/genesis-ai` (клиент **не** может задать другой);
- `base_branch` = `main` (клиент **не** может задать другой);
- Issue number для assign — только Issue, **ранее созданный Broker** в том же `run_id`.

**Отсутствуют в коде:** merge, push, delete branch, admin, secrets, generic proxy, any other repo.

### 4.4 Allowlist

14. Host: только `api.github.com`.
15. Repo: только `kubzik96/genesis-ai`.
16. Context paths (read): фиксированный allowlist, минимум:
    - `bridge/QUEUE.md`
    - `bridge/HANDOFF.md`
    - `governance/Constitution.md`
    - `governance/DevelopmentWorkflow.md`
    - `specifications/INDEX.md`
    - `specifications/S-0001-Genesis-One-Window-Execution-Spike.md`
    - `specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md` (после Approval)
17. Любой другой path/method/repo → `403`.

### 4.5 Idempotency semantics (authoritative)

Для **каждого** write атомарно сохраняется запись:

| Поле | Описание |
|---|---|
| `idempotency_key` | из заголовка |
| `request_hash` | hash **нормализованного** request payload |
| `operation` | например `create_issue` / `assign_copilot` |
| `run_id` | из тела |
| `gate` | `G1` / `G2` |
| `state` | `PENDING` \| `SUCCEEDED` \| `FAILED` \| `UNKNOWN` |
| `safe_result` | безопасный response/result (без секретов) |

**Правила:**

1. **Новый ключ**
   - атомарно зарезервировать `state = PENDING` в Durable Object;
   - **только после** этого вызывать GitHub;
   - при успехе → `SUCCEEDED` + safe result;
   - при явной ошибке GitHub (4xx deterministic) → `FAILED` + safe error.

2. **Тот же ключ и тот же `request_hash`**
   - **не** выполнять новый GitHub call;
   - вернуть сохранённый safe result (replay).

3. **Тот же ключ и другой `request_hash`**
   - вернуть `409 IDEMPOTENCY_CONFLICT`;
   - GitHub **не** вызывать.

4. **Одновременные запросы**
   - сериализуются **одним** Durable Object;
   - только один запрос может выполнить upstream write.

5. **Timeout или неопределённый результат GitHub**
   - `state = UNKNOWN`;
   - автоматический повтор write **запрещён**;
   - вернуть `BLOCKED_RECONCILIATION_REQUIRED`;
   - сначала проверить Issue/status (read-only), затем отдельное решение (не silent retry).

### 4.6 Rate limits и ограничения run

18. Максимум **10** write-операций в час на `BROKER_SERVICE_TOKEN`.
19. Для одного `run_id` допускается максимум:
    - **один** успешный `POST /v1/issues`;
    - **один** успешный assign Copilot для Issue, созданного этим `run_id`.
20. Assign разрешён **только** для Issue, ранее созданного Broker в том же `run_id`.
21. Превышение лимитов → `429 RATE_LIMITED`, GitHub **не** вызывается.
22. Issue number, repository и base branch **нельзя** произвольно задавать для обхода процесса.

### 4.7 Broker authentication и Gates

23. Dify вызывает Broker с `BROKER_SERVICE_TOKEN`.
24. Write-запросы содержат:
    - `run_id`;
    - `gate` (`G1` | `G2`);
    - `confirmed_at` (ISO-8601);
    - `Idempotency-Key` (header).
25. Broker проверяет:
    - service token;
    - соответствие Gate операции (G1 → create issue; G2 → assign-copilot);
    - TTL `confirmed_at` (рекомендуется 5–15 минут);
    - idempotency rules (§4.5);
    - rate limits (§4.6);
    - repository и operation allowlist.

**Честная граница ответственности (обязательно зафиксировать):**

- Broker **не может** криптографически доказать, что кнопку в Dify нажал именно CEO.
- Human Gate обеспечивается **утверждённым Dify HITL workflow** (S-0001).
- Broker обеспечивает: service authentication, Durable Object idempotency, rate limits, allowlist, fail-closed.
- Отдельный `GATE_SIGNING_SECRET` **не обязателен** для MVP, если не даёт дополнительной проверяемой гарантии сверх service token + TTL + Durable Object idempotency.

### 4.8 Audit log

26. Каждая операция логируется: timestamp, endpoint, run_id, gate, idempotency_key, issue/PR numbers, GitHub status code, latency, outcome, idempotency state.
27. Audit **не** содержит: Authorization headers, PAT, service token, xAI keys, file secrets.
28. Retention MVP: platform logs, 7–14 дней; teardown удаляет сервис целиком.

### 4.9 Fail-closed

29. Отсутствие `GITHUB_PAT` при старте → fail-fast / health = BLOCKED.
30. Отсутствие Durable Object binding / storage → write endpoints fail-closed / BLOCKED.
31. Невалидный token / gate / TTL / path → отказ без вызова GitHub (где применимо).
32. GitHub 401/403/422/5xx → безопасная ошибка клиенту; mock-тесты покрывают эти случаи.
33. `UNKNOWN` → `BLOCKED_RECONCILIATION_REQUIRED`, без auto-retry write.

### 4.10 Live testing policy

34. **Запрещено** создавать отдельный dummy Issue или лишний PR «для проверки Broker».
35. Реальные GitHub write-операции впервые проверяются в утверждённом сценарии S-0001:

```text
bridge/QUEUE.md: �� → в
```

36. До live write Broker тестируется:
    - unit tests;
    - mocked GitHub responses;
    - negative tests (idempotency / rate limit / UNKNOWN / gate);
    - read-only health/context calls **после** deployment из проверенного commit SHA (в статусе WORKING → перед REVIEW).

---

## 5. Ограничения

- S-0002 **не** реализует Dify workflow и **не** заменяет S-0001.
- S-0002 **не** разблокирует T-006.
- Copilot Pro → только Issue Assignment API (B2), не Agent Tasks (B1).
- PAT permissions для assign нельзя уменьшить ниже документированного минимума GitHub.
- Installation token GitHub App **не** подходит для assign (нужен user token).
- CI в репозитории может отсутствовать (`CI_NOT_CONFIGURED`) — это не блокер S-0002.
- Broker — временный security boundary для spike; долгосрочная платформа решается после результатов S-0001/S-0002.
- Workers KV **не** является correctness store.

---

## 6. Dependencies

- S-0001 Revision 1 (Approved) — родительский spike;
- DR-0004 — Repository of Approved Specifications;
- `governance/DevelopmentWorkflow.md`;
- GitHub Copilot Pro + Cloud Agent для `kubzik96/genesis-ai`;
- Cloudflare Workers + **Durable Objects (SQLite storage)** + Workers Secrets;
- T-010 — операционная задача реализации (регистрируется в Bridge **отдельно** после Approval S-0002).

---

## 7. Assumptions

- CEO может создать Cloudflare-аккаунт, Worker, Durable Object binding и Secrets без глубокой DevOps-экспертизы.
- Fine-grained PAT с указанными permissions достаточен для assign `copilot-swe-agent[bot]` на Issue.
- Dify может вызывать HTTPS endpoints Broker с Bearer token и custom headers.
- Для MVP достаточно polling PR из Dify; webhooks не нужны.
- Unit + mocked + negative tests достаточны до первого live write в сценарии S-0001.
- Один Durable Object instance на репозиторий `kubzik96/genesis-ai` достаточен для сериализации write MVP.

---

## 8. Критерии готовности (Acceptance Criteria)

### Core

- [ ] Код Broker находится в Git (`services/genesis-broker/`).
- [ ] Deployment соответствует проверенному commit SHA.
- [ ] Запрос к другому repository отклоняется `403`.
- [ ] Неизвестный endpoint/method отклоняется.
- [ ] Path вне context allowlist отклоняется.
- [ ] Запрос без service token отклоняется.
- [ ] Просроченный Gate (`confirmed_at` вне TTL) отклоняется.
- [ ] Audit не содержит Authorization, PAT или file secrets.
- [ ] Merge / push / delete endpoints **отсутствуют** в коде.
- [ ] GitHub PAT никогда не попадает в Dify.
- [ ] Секреты отсутствуют в Git и тестовых fixtures.
- [ ] Mocked tests покрывают GitHub 401 / 403 / 422 / 5xx.
- [ ] Worker можно полностью удалить (teardown documented).
- [ ] PAT можно отозвать одним действием в GitHub UI.
- [ ] Отсутствие PAT или Durable Object binding → fail-fast / BLOCKED.
- [ ] Никакая операция не выполняется с другим репозиторием.
- [ ] `repository` жёстко = `kubzik96/genesis-ai`; `base_branch` жёстко = `main`.
- [ ] Документация: deployment, secrets, rotation, revoke, teardown — без секретов.

### Idempotency / Durable Object

- [ ] Authoritative store = **SQLite-backed Durable Object** (не Workers KV).
- [ ] Все write для repo проходят через один Durable Object и сериализуются.
- [ ] Новый ключ: atomic `PENDING` → затем GitHub call.
- [ ] Тот же ключ + тот же request hash → replay без второго GitHub call.
- [ ] Тот же ключ + другой request hash → `409 IDEMPOTENCY_CONFLICT`, GitHub не вызывается.
- [ ] Concurrent writes: только один upstream write.
- [ ] Timeout / indeterminate GitHub → `UNKNOWN` + `BLOCKED_RECONCILIATION_REQUIRED`; auto-retry write запрещён.

### Rate limits / run bounds

- [ ] >10 write/час на token → `429 RATE_LIMITED`, GitHub не вызывается.
- [ ] Второй успешный create Issue в том же `run_id` → отклонён.
- [ ] Второй успешный assign в том же `run_id` → отклонён.
- [ ] Assign Issue, не созданного Broker в этом `run_id` → отклонён.

---

## 9. Способы проверки

1. `git` — наличие исходников и отсутствие секретов в tree.
2. Unit + mocked tests — allowlist, Durable Object idempotency states, gate TTL, GitHub error mapping.
3. Negative tests:
   - idempotency conflict (same key, different hash);
   - replay (same key, same hash);
   - concurrent write serialization;
   - `UNKNOWN` / reconciliation required;
   - rate limit 429;
   - second create/assign in same `run_id`;
   - assign foreign Issue;
   - expired gate; no token; wrong path/repo.
4. Deployed `/v1/health` — fail-fast при отсутствии secrets / Durable Object.
5. Code review: отсутствие merge/push/delete routes; отсутствие KV correctness path.
6. Secret scan fixtures и docs.
7. Teardown drill: удаление Worker + Durable Object + revoke PAT (после spike или по решению CEO).

---

## 10. Ожидаемые выходные артефакты

- Исходный код в `services/genesis-broker/` (Worker + Durable Object).
- Документация в `docs/genesis-broker/` (deploy, secrets, rotation, revoke, teardown, idempotency states).
- Набор unit/mocked/negative tests с зелёным прогоном.
- Deployed Worker URL (после EA) + commit SHA binding.
- Краткий отчёт: покрытие тестами, известные ограничения, готовность к live write в S-0001.

---

## 11. Необходимость Decision Record

- [x] **Отдельный DR для MVP Broker не требуется** на этапе Specification.
- [ ] После production-решения о долгосрочной security boundary / Execution Platform может потребоваться DR (совместно с итогами S-0001).

---

## 12. Риски и открытые вопросы

| Риск | Митигация |
|---|---|
| Assign API отклоняет Copilot bot / permissions | Mock + T-010 → BLOCKED при устойчивом live 401/403/422; не расширять scope без CEO |
| PAT слишком широкий (Contents/Actions Write) | Repo-only; short expiry; allowlist; no merge; audit; revoke |
| Replay / double Issue | Durable Object idempotency + request hash |
| Concurrent double-write | Single Durable Object serialization |
| Indeterminate GitHub result | `UNKNOWN` + no auto-retry + reconciliation |
| Ложное ощущение «CEO cryptographically proven» | Gate = Dify HITL, не crypto proof |
| Утечка PAT в логи | Redaction; запрет логировать headers/body secrets |
| Cloudflare vendor lock для spike | Тонкий HTTP proxy; код в Git; teardown documented |
| Live write до S-0001 E2E | Запрет dummy Issue/PR; только mocks до encoding scenario |
| KV eventual consistency mistakes | KV **не** используется для correctness |

Открытые вопросы (решить до/во время Execution):

1. Точный TTL Gate (рекомендация 5–15 мин) — зафиксировать в реализации.
2. Имя / id единственного Durable Object для repo — зафиксировать в deploy docs.
3. Binding commit SHA → deployment (wrangler / CI manual) — описать в docs.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-07-24 | Grok — Chief Architect | Создан In Review; Path B2; Cloudflare Workers; Issue Assignment API |
| 1 | 2026-07-24 | Grok — Chief Architect | Durable Object (не KV) как authoritative idempotency; точная семантика PENDING/SUCCEEDED/FAILED/UNKNOWN; rate limits; lifecycle T-010 |
| 1 | 2026-07-24 | CEO Genesis AI | CEO Approval; Specification approved; Execution Authorization remains NOT_GRANTED |

---

## 14. Связь с S-0001 и lifecycle T-010

```text
S-0002 Approved → T-010 registered → EA for S-0002
        ↓
T-010 WORKING: code + mocks + deploy (no live write)
        ↓
T-010 REVIEW: ready candidate (still no DONE)
        ↓
T-009 may use REVIEW-candidate Broker for one encoding scenario
        ↓
Live write (QUEUE �� → в) → independent review → CEO accepts T-010 → DONE
```

### Lifecycle T-010

**READY → WORKING** только после:

- S-0002 Approved и опубликована в `main`;
- T-010 зарегистрирована в Bridge;
- отдельный CEO **Execution Authorization** выдан для S-0002 Revision 1.

**WORKING → REVIEW** после:

- код Broker находится в Git;
- независимый implementation review выполнен;
- unit / mocked / negative tests проходят;
- Worker deployed из **точного** проверенного commit SHA;
- read-only health/context smoke пройден;
- секреты отсутствуют в Git и логах;
- **live write ещё не выполнялся**.

**REVIEW → DONE** только после утверждённого live-сценария S-0001:

- Broker создал один структурированный Issue;
- Broker назначил Copilot через Issue Assignment API;
- Copilot открыл PR;
- Broker получил PR metadata и **фактический** diff;
- deployment соответствовал проверенному commit SHA;
- независимый review подтвердил Broker-артефакты;
- CEO **отдельно** принял результат T-010.

До live-подтверждения T-010 остаётся **REVIEW**, а не DONE.

**T-010 → BLOCKED** при:

- устойчивом `401` / `403` / `422`;
- невозможности assign Copilot;
- нарушении security boundary.

**T-009** разрешается использовать Broker-кандидат в статусе **REVIEW** только для **одного** утверждённого encoding-сценария S-0001.

- S-0002 **не** включает Dify/xAI.
- S-0001 **не** хранит PAT.
- T-006 остаётся BLOCKED.
- Bridge (T-010) регистрируется **отдельно** после Approval S-0002 — **не** в этом PR.

---

## 15. Зафиксированные security decisions (основание S-0002)

1. Path **B2**: Broker + Copilot Issue Assignment API (Copilot Pro).
2. Path **B1** (Agent Tasks API) не используется на текущем тарифе.
3. PAT **запрещён** в Dify.
4. PAT только в Worker Secrets; repo-only; short expiry.
5. Permissions: Metadata Read; Actions/Contents/Issues/Pull requests Read & Write.
6. Allowlist-only operations; no merge/push/delete/proxy.
7. Human Gate = Dify HITL; Broker = service auth + Durable Object idempotency + rate limits + allowlist.
8. **Authoritative idempotency store = SQLite-backed Durable Object** (не Workers KV).
9. KV не используется для MVP correctness (и не как optional cache в MVP).
10. Idempotency states: PENDING / SUCCEEDED / FAILED / UNKNOWN; conflict → 409; UNKNOWN → no auto-retry.
11. Rate limit: 10 writes/hour/token; one successful create + one successful assign per `run_id`.
12. Repo fixed `kubzik96/genesis-ai`; base branch fixed `main`.
13. `GATE_SIGNING_SECRET` optional for MVP.
14. Live GitHub writes only via approved S-0001 encoding scenario.
15. T-010 DONE only after live S-0001 confirmation; else REVIEW or BLOCKED.
16. T-006 remains BLOCKED.
17. S-0001 Revision 1 not modified by this Specification.
