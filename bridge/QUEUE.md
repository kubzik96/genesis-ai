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
| T-002 | Создать критерии оценки CTO | BACKLOG | ChatGPT (COO) |
| T-003 | Подготовить тестовое задание для CTO | BACKLOG | ChatGPT (COO) |
| T-004 | Провести испытание моделей | BACKLOG | ChatGPT (COO) |
| T-005 | Оформить DR-0003 по результатам | BACKLOG | ChatGPT (COO) |

### Sprint: Genesis One-Window MVP

| ID | Название | Статус | Исполнитель |
|---|---|---|---|
| T-009 | Genesis One-Window Execution Spike | REVIEW | Integration Engineer |
| T-010 | Genesis Secure GitHub Broker MVP | REVIEW | Integration Engineer |

T-009: **REVIEW** (not DONE). Stage 4 = **PARTIAL PASS**.  
SoR synchronization after Stage 4 выполняется по **Approved S-0004 Revision 1**.  
S-0001 **Revision 2** = **Approved** (2026-08-07).  
CEO Approval S-0001 Revision 2 **не** является новым blanket Execution Authorization на One-Window implementation.

#### Stages 1–3 (история)

- **Stage 1 DIFY_CONFIG_ONLY:** completed (workflow skeleton / MOCK app preserved)
- **Stage 2 DIFY_READONLY_WIRING:** completed (`POST /v1/context/read` via Genesis Broker)
- **Stage 3 ISSUE_CREATE_ONLY:** **PARTIAL PASS**
- **GitHub Issue #15:** [open](https://github.com/kubzik96/genesis-ai/issues/15) — historical Stage 3 result; body sections «Команда CEO» / «Контекст из GitHub» were empty (Dify template binding)
- **Created via:** Genesis Broker `POST /v1/issues` after Gate 1 confirmation
- **Idempotent replay:** same key → same Issue #15; no second Issue
- **LIVE Dify app (`Genesis One-Window LIVE Stage 3`):** unpublished

#### Stage 4 (текущий итог)

- **Result:** **PARTIAL PASS** (not PASS)
- **Historical state:** Stage 4 was **NOT_AUTHORIZED** until separate CEO authorization
- **GitHub Issue:** [#19](https://github.com/kubzik96/genesis-ai/issues/19) — **CLOSED** (`completed`)
- **Execution PR:** [#20](https://github.com/kubzik96/genesis-ai/pull/20) — **MERGED** (squash)
- **Squash commit in main:** [`99e6d153ac91b2bf25f9604d58fe51c387ba3d28`](https://github.com/kubzik96/genesis-ai/commit/99e6d153ac91b2bf25f9604d58fe51c387ba3d28)
- **Changed files in PR #20:** only `bridge/QUEUE.md`
- **Change:** reserved encoding artifact `��` → Cyrillic `в` in the QUEUE update-rule line
- **Encoding fix:** **applied in main** (verified post-merge)
- **Auto-merge:** not used
- **CI:** `CI_NOT_CONFIGURED`
- **Copilot runner limitation:** automatic runner did not complete the full implementation cycle; target diff was accepted after independent review and separate CEO Gate 3 / Gate 4 decisions
- **Full One-Window cycle without manual steps:** **not achieved**
- **T-009 remains REVIEW** (not DONE) until a reproducible One-Window cycle is accepted by CEO

T-010 выполняется по Approved Specification S-0002 Revision 1. Status: **REVIEW** (not DONE).

- **Stage 1 CODE_ONLY:** ACCEPTED
- **Exact candidate SHA:** `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Tests:** passed 60; failed 0; skipped 0 (`node --test tests/**/*.test.js`)
- **CI:** `CI_NOT_CONFIGURED`
- **Stage 2 DEPLOY_READONLY:** COMPLETED / PASS
- **Cloudflare Worker:** `genesis-broker`
- **Final deployed version:** `654c3dff-70a2-4583-a5e9-a19f78a792da`
- **Traffic:** 100%
- **Health smoke:** PASS (repository `kubzik96/genesis-ai`; base_branch `main`; pat_configured true; durable_object_configured true; kv_used false)
- **Authenticated context/read smoke:** PASS (`bridge/QUEUE.md` / `main`)
- **GitHub PAT (audit, no token value):** repo-only fine-grained; Issues Read and write at Stage 3; Contents Write / Pull requests Write / Actions Write / Administration: No access; stored only as Cloudflare Worker Secret
- **BROKER_SERVICE_TOKEN:** stored only as Cloudflare Worker Secret
- **Cloudflare temporary deployment API token:** revoked after smoke
- **Local shell secrets:** cleared
- **PR #11:** Draft, open, unmerged; HEAD `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Merge of PR #11:** NOT_AUTHORIZED

Restrictions:

- T-010 remains **REVIEW** until separate CEO acceptance;
- T-010 is **not** DONE;
- T-009 is **REVIEW**, not DONE;
- T-006 remains BLOCKED;
- further GitHub writes, merge of other PRs, and DONE transitions require **separate** CEO authorization.

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
- QUEUE.md обновляется в том же commit, что и результат работы.
