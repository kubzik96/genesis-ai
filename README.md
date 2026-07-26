# Genesis AI

Genesis AI — система совместной работы человека и ИИ-агентов для создания, развития и сопровождения программных продуктов.

## Миссия

Создать практическую ИИ-команду, которая умеет превращать идеи в работающие решения, сохранять знания и улучшать собственные процессы.

## Участники (оперативный состав)

| Роль | Исполнитель | Примечание |
|---|---|---|
| **CEO** | Человек | Владелец проекта, финальные решения, Execution / Merge Authorization |
| **COO** | ChatGPT | Процесс, координация, анализ и review; **GitHub write недоступен** |
| **Chief Architect** | Grok | Независимая архитектурная оценка; GitHub-изменения **только** в пределах CEO Authorization |
| **Lead Engineer** | GitHub Copilot | Реализация назначенных задач через контролируемый Issue → PR |
| **Repository / SoR** | GitHub | Единый источник истины |

Роль **CTO** (постоянный) **не занята**: выбор — задачи T-002…T-005 (BACKLOG). Архитектурные обязанности на текущем этапе покрывает Chief Architect.

## Текущий статус (SoR: `main`)

Фаза 2 — Архитектура / One-Window spike в работе.

| Задача | Статус | Кратко |
|---|---|---|
| **T-009** One-Window Spike (S-0001) | **WORKING** | Stage 3 ISSUE_CREATE_ONLY = **PARTIAL PASS**; Issue [#15](https://github.com/kubzik96/genesis-ai/issues/15) open; Stage 4 **NOT_AUTHORIZED** |
| **T-010** Secure GitHub Broker (S-0002) | **REVIEW** | Stage 2 DEPLOY_READONLY completed; code on PR #11 Draft |
| **T-006** Orchestrator | **BLOCKED** | Нет Approved Spec + EA |

Оперативный SoR задач: `bridge/QUEUE.md` (не дублировать полностью здесь).

Единое окно (Dify end-to-end) **ещё не завершено**.

## Структура репозитория (канонические пути)

| Путь | Назначение |
|---|---|
| `governance/` | Constitution, Roles, Principles, Standards, DevelopmentWorkflow |
| `strategy/` | Vision, Roadmap |
| `decisions/` | Decision Records |
| `specifications/` | Approved Specifications (DR-0004) |
| `bridge/` | QUEUE / HANDOFF — операционное состояние |
| `templates/` | Шаблоны (в т.ч. Decision Record) |
| `projects/` | Продукты |
| `archive/` | Устаревшие материалы |
| `MEMORY.md` / `ACTIVE.md` | Долговременная память / сессионный снимок |

> Каталоги с кириллическими именами (`00_Управление/`, `01_Стратегия/`, …) содержат **legacy/stub** файлы. Канон — пути в таблице выше. См. deprecation-заголовки в stub-файлах.

## Рабочий цикл

Idea → Specification → CEO Approval → Execution Authorization → Implementation (branch/PR) → Independent review → CEO Merge Authorization → Post-merge verification → Bridge DONE.

Подробности: `governance/DevelopmentWorkflow.md`.

## Ближайший фокус

1. Закрыть качество Issue #15 / Dify bindings (без Stage 4, пока нет CEO auth).
2. Stage 4 (Copilot assign) — **только** после отдельного CEO Authorization.
3. Не объявлять T-009 / T-010 DONE до live-сценария encoding и принятия CEO.
