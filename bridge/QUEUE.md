# Bridge: Work Queue

## Назначение

QUEUE.md содержит очередь всех активных и ожидающих работ в Genesis AI.

Статус обновляется в реальном времени. Это единый источник истины о том, что делается, что ждёт, и почему задачи заблокированы.

---

## Статусы задач

- **BACKLOG** — задача сформулирована, ожидает уточнения;
- **READY** — полный контекст готов, можно начинать;
- **WORKING** — исполнитель работает;
- **REVIEW** — ожидает проверки перед завершением;
- **DONE** — завершена и принята;
- **BLOCKED** — не может продвигаться из-за зависимость.

---

## Активные задачи (Фаза 2 — Архитектура)

### Sprint: Decision System v1

| ID | Название | Статус | Исполнитель |
|---|---|---|---|
| T-002 | Создать критерии оценки CTO | BACKLOG | ChatGPT (CTO) |
| T-003 | Подготовить тестовое задание для CTO | BACKLOG | ChatGPT (CTO) |
| T-004 | Провести испытание моделей | BACKLOG | ChatGPT (CTO) |
| T-005 | Оформить DR-0003 по результатам | BACKLOG | ChatGPT (CTO) |

### Sprint: Genesis One-Window MVP

| ID | Название | Статус | Исполнитель |
|---|---|---|---|
| T-009 | Genesis One-Window Execution Spike | READY | Integration Engineer |
| T-010 | Genesis Secure GitHub Broker MVP | WORKING | Integration Engineer |

T-009 готова только к preflight. Approved Specification: S-0001 Revision 1. Execution Authorization: NOT_GRANTED. Реализация запрещена до отдельного решения CEO.

T-010 выполняется по Approved Specification S-0002 Revision 1. Status: **WORKING**.

- **Stage 1 CODE_ONLY:** ACCEPTED
- **Accepted exact HEAD:** `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Tests:** passed 60; failed 0; skipped 0 (`node --test tests/**/*.test.js`, Node.js v24.18.0)
- **Stage 2 DEPLOY_READONLY:** GRANTED (authorization record only; deployment NOT_STARTED)
- **PAT:** NOT_CREATED
- **Worker Secrets:** NOT_CREATED
- **Live writes:** NOT_AUTHORIZED
- **Dify integration:** NOT_AUTHORIZED
- **PR #11 modification / merge:** NOT_AUTHORIZED

Sequence before any deployment:

1. independent review of the Stage 2 authorization-record PR;
2. separate CEO merge authorization;
3. merge of the authorization record to `main`;
4. separate CEO **EXECUTE DEPLOY** command.

Restrictions:

- Cloudflare deployment, PAT creation and Worker Secrets remain forbidden **until** the separate CEO **EXECUTE DEPLOY** command;
- live GitHub writes, `POST /v1/issues`, assign-copilot and Dify integration remain forbidden **throughout** Stage 2 DEPLOY_READONLY (including after any future deploy/smoke);
- those write/integration operations require a **separate future CEO authorization** under the approved S-0001 live-write scenario.

T-010 remains **WORKING** (not DONE).

---

## Заблокированные задачи

| ID | Название | Статус | Исполнитель | Причина |
|---|---|---|---|---|
| T-006 | Реализовать Orchestrator v0.1 | BLOCKED | GitHub Copilot | Нет Approved Specification и отдельного Execution Authorization. Реализация остановлена до нового решения CEO. |

---

## Завершённые задачи

| ID | Название | Статус | Исполнитель | Подтверждение |
|---|---|---|---|
| T-001 | Создать инфраструктуру Bridge | DONE | GitHub Copilot | Bridge создан в main (`294eb9cc5805ae8f3d5a32b5e8a5588563a77231`) и фактически используется |
| T-007 | Development Workflow v1 | DONE | GitHub Engineer | PR #2; merge `7636f9872e4253d40688c45ef937db233175ef39`; post-merge verified |
| T-008 | Repository of Approved Specifications / DR-0004 | DONE | GitHub Engineer | PR #1; merge `e6f696270fad4173ac45dddc237b81210ba4aeea`; post-merge verified |

T-001 закрыт решением CEO: Bridge создан и используется.
T-007 и T-008 закрыты отдельным решением CEO после merge и post-merge verification.

---

## Правила обновления QUEUE.md

- Каждая задача имеет ID и статус из указанного списка;
- Статус обновляется перед началом и после завершения работы;
- Если задача переходит в BLOCKED, указывается причина;
- QUEUE.md обновляется �� том же commit, что и результат работы.
