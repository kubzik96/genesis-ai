# Genesis AI Memory

## Назначение

Долговременная память: подтверждённые сведения и знания между сессиями.
**Не** заменяет `bridge/QUEUE.md` (оперативные статусы задач) и **не** заменяет Approved Specifications.

---

## Основные сведения

- **Название:** Genesis AI
- **Фаза:** 2 — Архитектура / One-Window spike
- **SoR:** GitHub `kubzik96/genesis-ai`
- **Контрольная точка main после PR #16 / base PR #17:** `d3ed88ae0fe86ec284375b9ca54ba018dff2062f`
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

Устаревшее: «ChatGPT временно CTO» — **снято** (DR-0005).

---

## Завершённые циклы (высокоуровнево)

1. **Основание** — GitHub, Constitution, Roles, Principles, Standards, Vision, Roadmap.
2. **Структура** — каталоги, Decision Records (DR-0001, DR-0002).
3. **Governance bootstrap** — T-007 Development Workflow, T-008 / DR-0004 Specifications repo (**DONE**).
4. **Broker MVP (T-010)** — Stage 1 CODE_ONLY + Stage 2 DEPLOY_READONLY → Bridge **REVIEW** (не DONE).
5. **One-Window (T-009)** — Stage 1–2 Dify + Stage 3 ISSUE_CREATE_ONLY **PARTIAL PASS** (Issue #15); Stage 4 **не** разрешён.
6. **DR-0005** — Operational AI Team Roles (2026-07-27).

### Историческая пометка PR #16

Содержательно SoR Stage 3 принят. CEO запрашивал squash; GitHub создал **merge commit** `d3ed88ae…`. Переписывание истории main **не** требуется.

---

## Активный фокус (детали в QUEUE)

- T-009 WORKING — encoding-сценарий S-0001; Issue #15 open (пустые секции «Команда CEO» / «Контекст из GitHub» — known limitation).
- T-010 REVIEW — Broker deployed read path; PR #11 Draft.
- T-006 BLOCKED.
- T-002…T-005 BACKLOG (CTO selection).

---

## Принципы памяти

- Если изменение не в GitHub — оно не часть Genesis AI.
- QUEUE = оперативный SoR задач; MEMORY = устойчивые факты.
- Секреты и значения PAT/token в MEMORY **не** хранятся.
