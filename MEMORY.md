# Genesis AI Memory

## Назначение

Долговременная память: подтверждённые сведения и знания между сессиями.
**Не** заменяет `bridge/QUEUE.md` (оперативные статусы задач) и **не** заменяет Approved Specifications.

---

## Основные сведения

- **Название:** Genesis AI
- **Фаза:** 2 — Архитектура / One-Window spike
- **SoR:** GitHub `kubzik96/genesis-ai`
- **Контрольная точка main (после PR #21):** `fced49eff5fd88cece5159a4902bd14e989e390d`
- **Stage 4 encoding squash (PR #20):** `99e6d153ac91b2bf25f9604d58fe51c387ba3d28`
- **Главная цель:** управляемая ИИ-команда для проектирования, разработки и сопровождения продуктов

---

## Участники (актуальные, DR-0005)

| Роль | Исполнитель |
|---|---|
| CEO | Человек — окончательные решения |
| COO | ChatGPT — процессы, координация, review; без GitHub write |
| Chief Architect | Grok — архитектура, dissent, GitHub execution по CEO auth |
| Lead Engineer | GitHub Copilot — реализация через Issue → PR (DR-0002) |
| CTO (постоянный) | **Вакансия** — отбор T-002…T-005 (BACKLOG) |
| Codex | **Не формализован** — кандидат на DR-0006 (S-0003); без постоянных write/EA/merge |

Устаревшее: «ChatGPT временно CTO» — **снято** (DR-0005).

---

## Завершённые циклы (высокоуровнево)

1. **Основание** — GitHub, Constitution, Roles, Principles, Standards, Vision, Roadmap.
2. **Структура** — каталоги, Decision Records (DR-0001, DR-0002).
3. **Governance bootstrap** — T-007 Development Workflow, T-008 / DR-0004 Specifications repo (**DONE**).
4. **Broker MVP (T-010)** — Stage 1 CODE_ONLY + Stage 2 DEPLOY_READONLY → Bridge **REVIEW** (не DONE).
5. **One-Window (T-009)** — Stages 1–3 Dify/Broker; Stage 3 PARTIAL PASS (Issue #15); Stage 4 **PARTIAL PASS** (Issue #19 CLOSED, PR #20 MERGED `99e6d153…`); T-009 → **REVIEW** (не DONE).
6. **DR-0005** — Operational AI Team Roles (2026-07-27).
7. **S-0003** — Approved in main (PR #21, 2026-08-07): Post-Stage-4 SoR synchronization + Codex role definition (implementation via separate PRs; EA conditional).

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
- S-0003 implementation: PR A (SoR sync) then PR B (DR-0006 + Roles).
- T-006 BLOCKED.
- T-002…T-005 BACKLOG (CTO selection).

---

## Принципы памяти

- Если изменение не в GitHub — оно не часть Genesis AI.
- QUEUE = оперативный SoR задач; MEMORY = устойчивые факты.
- Секреты и значения PAT/token в MEMORY **не** хранятся.
