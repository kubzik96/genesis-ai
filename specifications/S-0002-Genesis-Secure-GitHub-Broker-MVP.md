# S-0002 — Genesis Secure GitHub Broker MVP

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0002 |
| **Название** | Genesis Secure GitHub Broker MVP |
| **Статус** | In Review |
| **Revision** | 1 |
| **Автор** | Grok — Chief Architect |
| **Дата создания** | 2026-07-24 |
| **Дата утверждения** | — |
| **Утвердил** | — |
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
- audit и idempotency;
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
5. предоставляет S-0001 безопасный путь:
   - чтение approved context;
   - создание структурированного Issue;
   - назначение `copilot-swe-agent[bot]`;
   - чтение PR metadata, changed files, diff, mergeability и CI/status.

---

## 3. Scope

### В Scope (разрешено)

- Worker source code (Cloudflare Workers);
- конфигурация deployment **без** секретов;
- unit tests;
- mocked GitHub API tests;
- строгая repository/operation allowlist;
- service authentication (`BROKER_SERVICE_TOKEN`);
- idempotency (Workers KV);
- TTL и replay protection;
- audit log с redaction секретов;
- endpoints (см. §4.3);
- документация:
  - deployment;
  - secrets;
  - rotation;
  - revoke;
  - teardown;
- fail-closed поведение (отсутствие KV/PAT → fail-fast / BLOCKED).

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
- создание dummy Issue / лишнего PR до утверждённого сценария S-0001.

### Разрешённые пути исходного кода (после Execution Authorization)

В репозитории **нет** существующей структуры `services/` или `docs/`. Зафиксированные пути:

```text
services/genesis-broker/
docs/genesis-broker/
```

Допускаются только файлы, необходимые для Worker, тестов и документации без секретов.

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

1. **Cloudflare Workers** — целевая платформа.
2. **Workers Secrets** — хранение `GITHUB_PAT`, `BROKER_SERVICE_TOKEN`.
3. **Workers KV** — idempotency keys и replay protection.
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
Write headers: `Idempotency-Key`, тело с `run_id`, `gate`, `confirmed_at`.

| Method | Path | Gate | Назначение |
|---|---|---|---|
| `GET` | `/v1/health` | — | liveness; fail-fast если нет PAT/KV |
| `POST` | `/v1/context/read` | — | read-only approved context paths |
| `POST` | `/v1/issues` | G1 | create structured Issue |
| `POST` | `/v1/issues/{number}/assign-copilot` | G2 | assign `copilot-swe-agent[bot]` + `agent_assignment` |
| `GET` | `/v1/issues/{number}/status` | — | issue assignees + linked hints |
| `GET` | `/v1/pulls/{number}` | — | PR metadata, mergeability, CI |
| `GET` | `/v1/pulls/{number}/diff` | — | changed files + unified diff |

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

### 4.5 Broker authentication и Gates

18. Dify вызывает Broker с `BROKER_SERVICE_TOKEN`.
19. Write-запросы содержат:
    - `run_id`;
    - `gate` (`G1` | `G2`);
    - `confirmed_at` (ISO-8601);
    - `Idempotency-Key` (header).
20. Broker проверяет:
    - service token;
    - соответствие Gate операции (G1 → create issue; G2 → assign-copilot);
    - TTL `confirmed_at` (рекомендуется 5–15 минут);
    - повторное использование Idempotency-Key (повтор → тот же результат, без второй GitHub-операции);
    - repository и operation allowlist.

**Честная граница ответственности (обязательно зафиксировать):**

- Broker **не может** криптографически доказать, что кнопку в Dify нажал именно CEO.
- Human Gate обеспечивается **утверждённым Dify HITL workflow** (S-0001).
- Broker обеспечивает: service authentication, replay protection, allowlist enforcement, fail-closed.
- Отдельный `GATE_SIGNING_SECRET` **не обязателен** для MVP, если не даёт дополнительной проверяемой гарантии сверх service token + TTL + idempotency.

### 4.6 Audit log

21. Каждая операция логируется: timestamp, endpoint, run_id, gate, idempotency_key, issue/PR numbers, GitHub status code, latency, outcome.
22. Audit **не** содержит: Authorization headers, PAT, service token, xAI keys, file secrets.
23. Retention MVP: platform logs, 7–14 дней; teardown удаляет сервис целиком.

### 4.7 Fail-closed

24. Отсутствие `GITHUB_PAT` при старте → fail-fast / health = BLOCKED.
25. Отсутствие KV (idempotency store) → fail-fast для write-операций.
26. Невалидный token / gate / TTL / path → отказ без вызова GitHub (где применимо).
27. GitHub 401/403/422/5xx → проброс безопасной ошибки клиенту; mock-тесты покрывают эти случаи.

### 4.8 Live testing policy

28. **До** Execution Authorization T-009 (S-0001 E2E) запрещено создавать отдельный dummy Issue или лишний PR «для проверки Broker».
29. Реальные GitHub write-операции впервые проверяются в утверждённом сценарии S-0001:

```text
bridge/QUEUE.md: �� → в
```

30. До live write Broker тестируется:
    - unit tests;
    - mocked GitHub responses;
    - read-only health/context calls **после** отдельного Authorization на deployment (если выдан).

---

## 5. Ограничения

- S-0002 **не** реализует Dify workflow и **не** заменяет S-0001.
- S-0002 **не** разблокирует T-006.
- Copilot Pro → только Issue Assignment API (B2), не Agent Tasks (B1).
- PAT permissions для assign нельзя уменьшить ниже документированного минимума GitHub.
- Installation token GitHub App **не** подходит для assign (нужен user token).
- CI в репозитории может отсутствовать (`CI_NOT_CONFIGURED`) — это не блокер S-0002.
- Broker — временный security boundary для spike; долгосрочная платформа решается после результатов S-0001/S-0002.

---

## 6. Dependencies

- S-0001 Revision 1 (Approved) — родительский spike;
- DR-0004 — Repository of Approved Specifications;
- `governance/DevelopmentWorkflow.md`;
- GitHub Copilot Pro + Cloud Agent для `kubzik96/genesis-ai`;
- Cloudflare Workers + Workers KV + Workers Secrets;
- T-010 — операционная задача реализации (регистрируется в Bridge отдельно после Approval).

---

## 7. Assumptions

- CEO может создать Cloudflare-аккаунт и Workers Secrets без глубокой DevOps-экспертизы.
- Fine-grained PAT с указанными permissions достаточен для assign `copilot-swe-agent[bot]` на Issue.
- Dify может вызывать HTTPS endpoints Broker с Bearer token и custom headers.
- Для MVP достаточно polling PR из Dify; webhooks не нужны.
- Unit + mocked tests достаточны до первого live write в сценарии S-0001.

---

## 8. Критерии готовности (Acceptance Criteria)

- [ ] Код Broker находится в Git (`services/genesis-broker/`).
- [ ] Deployment соответствует проверенному commit SHA.
- [ ] Запрос к другому repository отклоняется `403`.
- [ ] Неизвестный endpoint/method отклоняется.
- [ ] Path вне context allowlist отклоняется.
- [ ] Повторный write с тем же `Idempotency-Key` не создаёт вторую GitHub-операцию.
- [ ] Просроченный Gate (`confirmed_at` вне TTL) отклоняется.
- [ ] Запрос без service token отклоняется.
- [ ] Audit не содержит Authorization, PAT или file secrets.
- [ ] Merge / push / delete endpoints **отсутствуют** в коде.
- [ ] GitHub PAT никогда не попадает в Dify.
- [ ] Секреты отсутствуют в Git и тестовых fixtures.
- [ ] Mocked tests покрывают GitHub 401 / 403 / 422 / 5xx.
- [ ] Worker можно полностью удалить (teardown documented).
- [ ] PAT можно отозвать одним действием в GitHub UI.
- [ ] Отсутствие KV или PAT приводит к fail-fast / BLOCKED.
- [ ] Никакая операция не выполняется с другим репозиторием.
- [ ] Документация: deployment, secrets, rotation, revoke, teardown — без секретов.

---

## 9. Способы проверки

1. `git` — наличие исходников и отсутствие секретов в tree.
2. Unit + mocked tests — allowlist, idempotency, gate TTL, GitHub error mapping.
3. Deployed `/v1/health` — fail-fast при отсутствии secrets/KV.
4. Negative tests: wrong repo, unknown path, no token, replay key, expired gate.
5. Code review: отсутствие merge/push/delete routes.
6. Secret scan fixtures и docs.
7. Teardown drill: удаление Worker + revoke PAT (после spike или по решению CEO).

---

## 10. Ожидаемые выходные артефакты

- Исходный код в `services/genesis-broker/`.
- Документация в `docs/genesis-broker/` (deploy, secrets, rotation, revoke, teardown).
- Набор unit/mocked tests с зелёным прогоном.
- Deployed Worker URL (после EA) + commit SHA binding.
- Краткий отчёт: что покрыто тестами, известные ограничения, готовность к live write в S-0001.

---

## 11. Необходимость Decision Record

- [x] **Отдельный DR для MVP Broker не требуется** на этапе Specification.
- [ ] После production-решения о долгосрочной security boundary / Execution Platform может потребоваться DR (совместно с итогами S-0001).

---

## 12. Риски и открытые вопросы

| Риск | Митигация |
|---|---|
| Assign API отклоняет Copilot bot / permissions | Mock + BLOCKED при устойчивом live 422/403; не расширять scope без CEO |
| PAT слишком широкий (Contents/Actions Write) | Repo-only; short expiry; allowlist; no merge; audit; revoke |
| Replay / double Issue | Idempotency-Key + KV |
| Ложное ощущение «CEO cryptographically proven» | Явная фиксация: Gate = Dify HITL, не crypto proof |
| Утечка PAT в логи | Redaction; запрет логировать headers/body secrets |
| Cloudflare vendor lock для spike | Тонкий HTTP proxy; код в Git; teardown documented |
| Live write до S-0001 E2E | Запрет dummy Issue/PR; только mocks до сценария encoding |

Открытые вопросы (решить до/во время Execution):

1. Точный TTL Gate (рекомендация 5–15 мин) — зафиксировать в реализации.
2. Нужен ли Workers KV namespace отдельный от default — выбрать при deploy.
3. Binding commit SHA → deployment (wrangler / CI manual) — описать в docs.

---

## 13. История изменений

| Revision | Дата | Автор | Что изменено |
|---|---|---|---|
| 1 | 2026-07-24 | Grok — Chief Architect | Создан In Review; Path B2; Cloudflare Workers; Issue Assignment API; fail-closed; no live dummy writes |

---

## 14. Связь с S-0001 и порядок работ

```text
S-0002 (Broker)  →  deployment + mocked tests
        ↓
S-0001 (One-Window)  →  Dify workflow uses Broker
        ↓
Live write only in approved encoding scenario (QUEUE �� → в)
```

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
7. Human Gate = Dify HITL; Broker = service auth + replay + allowlist.
8. `GATE_SIGNING_SECRET` optional for MVP.
9. Live GitHub writes only via approved S-0001 encoding scenario.
10. T-006 remains BLOCKED.
11. S-0001 Revision 1 not modified by this Specification.
