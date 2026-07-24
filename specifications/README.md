# Specifications

## Что такое Specification

Specification — официальный документ функциональных требований к реализации.

Он отвечает на вопрос: **что нужно сделать**.

**Approved Specification является единственным источником функциональных требований для реализации.**

Specification **не** описывает архитектурное обоснование — это роль Decision Record.

Нельзя реализовывать:
- «по памяти»;
- «по сообщению в чате»;
- «по старой версии обсуждения».

Исполнитель работает только по утверждённой спецификации из этого каталога.

---

## Когда создавать

Specification создаётся **до начала реализации** любой значимой задачи.

После CEO Approval спецификация:
1. получает статус `Approved`;
2. публикуется в `specifications/`;
3. становится **необходимым основанием** для Execution Authorization.

**CEO Approval спецификации не является Execution Authorization.**  
Execution Authorization выдаётся CEO **отдельно** и должен быть явно зафиксирован.

Реализация начинается только после:
1. Approved Specification;
2. отдельного Execution Authorization CEO.

---

## Как связан с другими документами

| Документ | Вопрос | Роль |
|---|---|---|
| **Decision Record** (`decisions/`) | *Почему?* | Архитектурное решение и его обоснование |
| **Specification** (`specifications/`) | *Что?* | Функциональные требования к реализации |
| **Task** (`bridge/QUEUE.md`) | *Кто и когда?* | Операционный статус и исполнитель |
| **HANDOFF** (`bridge/HANDOFF.md`) | *Какой контекст?* | Передача контекста между агентами |

---

## Структура каталога

```text
specifications/
├── README.md
├── INDEX.md
├── _template.md
├── S-XXXX-Short-Name.md
└── archive/
```

- Статус хранится **в документе**, а не в пути.
- Файлы не перемещаются при смене статуса.
- `archive/` — только для спецификаций, которые больше не используются.

---

## Статусы

| Статус | Значение |
|---|---|
| `Draft` | Черновик |
| `In Review` | На независимом review |
| `Approved` | Утверждена CEO |
| `Superseded` | Заменена новой спецификацией |
| `Archived` | Больше не актуальна |

---

## Revision

| Тип изменения | Действие |
|---|---|
| **Minor** (уточнения без изменения Scope) | Новая Revision той же Specification |
| **Major** (изменение Scope, целей, критериев) | Новая Specification; предыдущая → `Superseded` |

---

## Связанные документы

- `decisions/DR-0004.md`
- `governance/Constitution.md`
- `governance/DevelopmentWorkflow.md`
- `bridge/QUEUE.md`
- `bridge/HANDOFF.md`
