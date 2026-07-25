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
| T-010 | Genesis Secure GitHub Broker MVP | REVIEW | Integration Engineer |

T-009 готова только к preflight. Approved Specification: S-0001 Revision 1. Execution Authorization: NOT_GRANTED. Реализация запрещена до отдельного решения CEO.

T-010 выполняется по Approved Specification S-0002 Revision 1. Status: **REVIEW** (not DONE).

- **Stage 1 CODE_ONLY:** ACCEPTED
- **Exact candidate SHA:** `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Tests:** passed 60; failed 0; skipped 0 (`node --test tests/**/*.test.js`)
- **CI:** `CI_NOT_CONFIGURED`
- **Stage 2 DEPLOY_READONLY:** COMPLETED / PASS
- **Cloudflare Worker:** `genesis-broker`
- **Final deployed version:** `654c3dff-70a2-4583-a5e9-a19f78a792da`
- **Traffic:** 100%
- **Script etag:** `25e9d66fe97ee6fa9029864adce8a5ba3dc67ebf74bb4693c949c19a615843f0`
- **Health smoke:** PASS
  - repository: `kubzik96/genesis-ai`
  - base_branch: `main`
  - pat_configured: true
  - durable_object_configured: true
  - kv_used: false
- **Authenticated context/read smoke:** PASS
  - path: `bridge/QUEUE.md`
  - ref: `main`
  - blob SHA: `b3b50a207ee1a1003a81e3a8ddf359506a6f8197`
  - content_length: 4999
  - content_sha256: `c9cbce62dd4313ccb2812c4be514ffc474947d41fecf0af59161e5b6731ac205`
- **GitHub PAT:** created as repo-only fine-grained PAT (Metadata Read + Contents Read only); stored only as Cloudflare Worker Secret
- **BROKER_SERVICE_TOKEN:** stored only as Cloudflare Worker Secret
- **Cloudflare temporary deployment API token:** revoked after smoke
- **Local shell secrets:** cleared
- **Local git worktree:** clean
- **Live GitHub writes:** NOT_AUTHORIZED and NOT_PERFORMED
- **Issue creation:** NOT_PERFORMED
- **Copilot assignment:** NOT_PERFORMED
- **Dify integration:** NOT_AUTHORIZED and NOT_PERFORMED
- **PR #11:** Draft, open, unmerged; HEAD `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Merge of PR #11:** NOT_AUTHORIZED

Restrictions (unchanged):

- T-010 remains **REVIEW** until the approved S-0001 live-write scenario and separate CEO acceptance;
- T-010 is **not** DONE;
- T-006 remains BLOCKED;
- first live GitHub write is **not** authorized;
- `POST /v1/issues`, assign-copilot, dummy Issue/PR, and Dify integration remain forbidden until separate future CEO authorization under S-0001.

---

## Заблокированные задачи

| ID | Название | Статус | Исполнитель | Причина |
|---|---|---|---|---|
| T-006 | Реализовать Orchestrator v0.1 | BLOCKED | GitHub Copilot | Нет Approved Specification и отдельного Execution Authorization. Реализация остановлена до нового решения CEO. |

---

## Завершённые задачи

| ID | Название | Статус | Исполнитель | Подтверждение |
|---|---|---|---|---|
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
