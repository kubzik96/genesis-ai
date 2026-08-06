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
| T-009 | Genesis One-Window Execution Spike | WORKING | Integration Engineer |
| T-010 | Genesis Secure GitHub Broker MVP | REVIEW | Integration Engineer |

T-009 выполняется по Approved Specification S-0001 Revision 1. Status: **WORKING** (not DONE).

- **Stage 1 DIFY_CONFIG_ONLY:** completed (workflow skeleton / MOCK app preserved)
- **Stage 2 DIFY_READONLY_WIRING:** completed (`POST /v1/context/read` via Genesis Broker)
- **Stage 3 ISSUE_CREATE_ONLY:** **PARTIAL PASS**
- **GitHub Issue:** [#15](https://github.com/kubzik96/genesis-ai/issues/15) — open
- **Title:** `T-009: Fix encoding artifact in bridge/QUEUE.md`
- **Created via:** Genesis Broker `POST /v1/issues` after Gate 1 confirmation
- **First live call:** HTTP 200, `issue_number: 15`
- **Idempotent replay:** same `Idempotency-Key` + same `payload_json` + same `run_id` → HTTP 200, same Issue #15; **no second Issue**
- **Copilot assignment:** NOT_PERFORMED
- **Execution PR:** NOT_CREATED
- **Direct push:** NOT_PERFORMED
- **xAI review:** NOT_PERFORMED
- **Merge:** NOT_PERFORMED
- **LIVE Dify app (`Genesis One-Window LIVE Stage 3`):** unpublished
- **Known limitation:** Issue #15 body sections «Команда CEO» and «Контекст из GitHub» were empty (Dify template binding); root cause not fully confirmed
- **No-write check:** Gate 1 → NO exercised; Issue #15 was **not** edited after creation
- **Stage 4 (Copilot assign):** NOT_AUTHORIZED
- **T-009 remains WORKING** (not DONE)

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
- **GitHub PAT (audit, no token value):**
  - **Stage 2 (DEPLOY_READONLY):** repo-only fine-grained `kubzik96/genesis-ai`; **Metadata: Read**; **Contents: Read**; Issues/PR/Actions/Administration: No access; stored only as Cloudflare Worker Secret
  - **Before Stage 3 ISSUE_CREATE_ONLY:** permissions **changed** — new/rotated repo-only fine-grained PAT for write path
  - **At Issue #15 creation (Stage 3):** repo-only fine-grained `kubzik96/genesis-ai`; **Metadata: Read**; **Contents: Read**; **Issues: Read and write**; Contents Write / Pull requests Write / Actions Write / Administration: **No access**; stored only as Cloudflare Worker Secret
- **BROKER_SERVICE_TOKEN:** stored only as Cloudflare Worker Secret
- **Cloudflare temporary deployment API token:** revoked after smoke
- **Local shell secrets:** cleared
- **PR #11:** Draft, open, unmerged; HEAD `6393c434d139657ea1deb8835cf8e6d523334a74`
- **Merge of PR #11:** NOT_AUTHORIZED

Restrictions (unchanged):

- T-010 remains **REVIEW** until the approved S-0001 live-write scenario completes and separate CEO acceptance;
- T-010 is **not** DONE;
- T-006 remains BLOCKED;
- Copilot assignment, execution PR, xAI API, merge, and further GitHub writes require **separate** CEO authorization;
- encoding fix (`��` → `в`) is **not** applied in this SoR record.

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
- QUEUE.md обновляется в том же commit, что и результат работы.
