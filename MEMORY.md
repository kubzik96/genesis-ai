# Genesis AI Memory

## Назначение

Долговременная память: подтверждённые сведения и знания между сессиями.
**Не** заменяет `bridge/QUEUE.md` (оперативные статусы задач) и **не** заменяет Approved Specifications.

---

## Основные сведения

- **Название:** Genesis AI
- **Фаза:** 2 — Архитектура / One-Window spike
- **SoR:** GitHub `kubzik96/genesis-ai`
- **Контрольная точка main:** `0c7ecbff2487ef09a36f1156dbced722ab62a114` (после PR #23)
- **Stage 4 encoding squash (PR #20):** `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`
- **Главная цель:** управляемая ИИ-команда для проектирования, разработки и сопровождения продуктов
- **Практический приоритет:** рабочий One-Window

---

## Specifications (устойчивые факты)

| ID | Status | Revision | Note |
|---|---|---|---|
| S-0001 | **Approved** | **2** | Approved 2026-08-07 after independent specification review (BLOCKERS NONE) + CEO Approval; Stage 4 PARTIAL PASS recorded; original One-Window criteria preserved |
| S-0002 | Approved | 1 | Broker MVP |
| S-0003 | **Superseded** | 1 | Superseded by S-0004 |
| S-0004 | **Approved** | 1 | Authoritative Specification for Post-Stage-4 SoR synchronization |

Next specification number: **S-0005**.

---

## Участники (актуальные, DR-0005)

| Роль | Исполнитель |
|---|---|
| CEO | Человек — окончательные решения |
| COO | ChatGPT — процессы, координация, review; без GitHub write |
| Chief Architect | Grok — архитектура, dissent, GitHub execution по CEO auth |
| Lead Engineer | GitHub Copilot — реализация через Issue → PR (DR-0002) |
| CTO (постоянный) | **Вакансия** — отбор T-002…T-005 (BACKLOG) |
| Codex | **Не формализован** — DR-0006 **deferred** until after next One-Window technical cycle; без постоянных write/EA/merge |

Устаревшее: «ChatGPT временно CTO» — **снято** (DR-0005).

---

## Завершённые циклы (высокоуровнево)

1. **Основание** — GitHub, Constitution, Roles, Principles, Standards, Vision, Roadmap.
2. **Структура** — каталоги, Decision Records (DR-0001, DR-0002).
3. **Governance bootstrap** — T-007 Development Workflow, T-008 / DR-0004 Specifications repo (**DONE**).
4. **Broker MVP (T-010)** — Stage 1 CODE_ONLY + Stage 2 DEPLOY_READONLY → Bridge **REVIEW** (не DONE).
5. **One-Window (T-009)** — Stages 1–3 Dify/Broker; Stage 3 PARTIAL PASS (Issue #15); Stage 4 **PARTIAL PASS** (Issue #19 CLOSED, PR #20 MERGED `99e6d153…`); T-009 → **REVIEW** (не DONE).
6. **DR-0005** — Operational AI Team Roles (2026-07-27).
7. **S-0004** — Approved in main (PR #23, 2026-08-07): Post-Stage-4 SoR synchronization governance correction; S-0003 Superseded.
8. **S-0001 Revision 2** — Approved 2026-08-07 (PR #22 approval commit); INDEX synced same commit; no new blanket EA.

### Историческая пометка PR #16

Содержательно SoR Stage 3 принят. CEO запрашивал squash; GitHub создал **merge commit** `d3ed88ae…`. Переписывание истории main **не** требуется.

### Stage 4 — подтверждённые факты

- Issue [#19](https://github.com/kubzik96/genesis-ai/issues/19): CLOSED / completed
- PR [#20](https://github.com/kubzik96/genesis-ai/pull/20): MERGED (squash)
- Squash commit: `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`
- Changed file: only `bridge/QUEUE.md` (`��` → `в`)
- Result: **PARTIAL PASS** — target diff accepted; full One-Window automation without manual steps **not** achieved
- Historical: Stage 4 was **NOT_AUTHORIZED** before separate CEO authorization
- CI: `CI_NOT_CONFIGURED`

---

## Активный фокус (детали в QUEUE)

- T-009 **REVIEW** — Stage 4 PARTIAL PASS recorded; not DONE.
- T-010 **REVIEW** — Broker deployed read path; PR #11 Draft; not DONE.
- S-0004 PR A (SoR sync) in PR #22 Draft; next = independent implementation review → CEO Merge Authorization.
- S-0001 = **Approved Revision 2**.
- DR-0006 **deferred** (not blocking One-Window critical path).
- T-006 BLOCKED.
- T-002…T-005 BACKLOG (CTO selection).

---

## Принципы памяти

- Если изменение не в GitHub — оно не часть Genesis AI.
- QUEUE = оперативный SoR задач; MEMORY = устойчивые факты.
- Секреты и значения PAT/token в MEMORY **не** хранятся.
