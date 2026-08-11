# Genesis AI Memory

## Назначение

Долговременная память: подтверждённые сведения и знания между сессиями.
**Не** заменяет `bridge/QUEUE.md` (оперативные статусы задач) и **не** заменяет Approved Specifications.

---

## Основные сведения

- **Название:** Genesis AI
- **Фаза:** 2 — Архитектура / One-Window + Limited Grok Executor
- **SoR:** GitHub `kubzik96/genesis-ai`
- **Контрольная точка main:** `e14faded46f61d0c32df117ced31480cf1b61062` (после PR #27)
- **Stage 4 encoding squash (PR #20):** `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`
- **Главная цель:** управляемая ИИ-команда для проектирования, разработки и сопровождения продуктов
- **Практический приоритет:** рабочий One-Window; limited Grok/xAI executor path (S-0005) как альтернатива недоступному Copilot Cloud Agent

---

## Specifications (устойчивые факты)

| ID | Status | Revision | Note |
|---|---|---|---|
| S-0001 | **Approved** | **3** | Approved 2026-08-11 (PR #27); documents continuation via S-0005; Approval itself did not grant EA |
| S-0002 | Approved | 1 | Broker MVP |
| S-0003 | **Superseded** | 1 | Superseded by S-0004 |
| S-0004 | **Approved** | 1 | Authoritative Specification for Post-Stage-4 SoR synchronization |
| S-0005 | **Approved** | **1** | Limited Grok/xAI executor path; Approved 2026-08-11 (PR #27) |

Next specification number: **S-0006**.

---

## Decision Records (устойчивые факты)

| ID | Status | Note |
|---|---|---|
| DR-0001 | Принято | Архитектурная структура |
| DR-0002 | Принято | GitHub Copilot = Engineer |
| DR-0004 | Принято | Repository of Approved Specifications |
| DR-0005 | Принято | Operational AI Team Roles |
| DR-0007 | **Принято** | Grok Limited Executor through Genesis Broker (2026-08-11, PR #27) |

---

## Участники (актуальные, DR-0005)

| Роль | Исполнитель |
|---|---|
| CEO | Человек — окончательные решения |
| COO | ChatGPT — процессы, координация, review; без GitHub write |
| Chief Architect | Grok — архитектура, dissent; limited executor по T-011 Stage 1 EA |
| Lead Engineer | GitHub Copilot — реализация через Issue → PR (DR-0002); Cloud Agent unavailable on Free |
| CTO (постоянный) | **Вакансия** — отбор T-002…T-005 (BACKLOG) |
| Codex | **Не формализован** — DR-0006 **deferred** |

Устаревшее: «ChatGPT временно CTO» — **снято** (DR-0005).

---

## Завершённые циклы (высокоуровнево)

1. **Основание** — GitHub, Constitution, Roles, Principles, Standards, Vision, Roadmap.
2. **Структура** — каталоги, Decision Records (DR-0001, DR-0002).
3. **Governance bootstrap** — T-007 Development Workflow, T-008 / DR-0004 Specifications repo (**DONE**).
4. **Broker MVP (T-010)** — Stage 1 CODE_ONLY + Stage 2 DEPLOY_READONLY → Bridge **REVIEW** (не DONE).
5. **One-Window (T-009)** — Stages 1–3 Dify/Broker; Stage 3 PARTIAL PASS (Issue #15); Stage 4 **PARTIAL PASS** (Issue #19 CLOSED, PR #20 MERGED `99e6d153…`); T-009 → **REVIEW** (не DONE).
6. **DR-0005** — Operational AI Team Roles (2026-07-27).
7. **S-0004** — Approved in main (PR #23, 2026-08-07): Post-Stage-4 SoR synchronization; S-0003 Superseded.
8. **S-0001 Revision 3 / S-0005 / DR-0007** — Approved/Accepted 2026-08-11 (PR #27); documentation boundary for limited Grok executor; Approval did not grant EA.
9. **T-011 Stage 1 EA** — 2026-08-11 CEO granted **CODE_AND_TESTS_ONLY** for `POST /v1/executions/grok/draft-pr`; deployment/secrets/live/smoke forbidden.

### Stage 4 — подтверждённые факты

- Issue [#19](https://github.com/kubzik96/genesis-ai/issues/19): CLOSED / completed
- PR [#20](https://github.com/kubzik96/genesis-ai/pull/20): MERGED (squash)
- Squash commit: `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`
- Result: **PARTIAL PASS** — target diff accepted; full One-Window automation without manual steps **not** achieved
- CI: `CI_NOT_CONFIGURED`

### PR #27 — подтверждённые факты

- Squash merge: `e14faded46f61d0c32df117ced31480cf1b61062`
- S-0001 R3 Approved; S-0005 R1 Approved; DR-0007 Accepted
- Execution Authorization **NOT_GRANTED** by the Approval itself

---

## Активный фокус (детали в QUEUE)

- **T-011 READY** — Stage 1 CODE_AND_TESTS_ONLY EA GRANTED; implement mocked composite endpoint; draft PR; independent non-Grok review.
- T-009 **REVIEW** — Stage 4 PARTIAL PASS recorded; not DONE.
- T-010 **REVIEW** — Broker deployed read path; PR #11 Draft; not DONE.
- DR-0006 **deferred** (not blocking).
- T-006 BLOCKED.
- T-002…T-005 BACKLOG (CTO selection).

---

## Принципы памяти

- Если изменение не в GitHub — оно не часть Genesis AI.
- QUEUE = оперативный SoR задач; MEMORY = устойчивые факты.
- Секреты и значения PAT/token/API keys в MEMORY **не** хранятся.
