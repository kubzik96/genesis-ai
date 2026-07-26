# ACTIVE

## Статус проекта

| Поле | Значение |
|---|---|
| Фаза | 2 — Архитектура Genesis AI / One-Window spike |
| Статус | Активная разработка |
| Последнее обновление | 2026-07-27 |
| Ориентир main HEAD | `d3ed88ae0fe86ec284375b9ca54ba018dff2062f` |

---

## Главная цель

Построить операционную систему Genesis AI для совместной работы человека и ИИ-агентов.

---

## Текущий спринт

**Genesis One-Window MVP** (S-0001 / S-0002)

| ID | Статус | Note |
|---|---|---|
| T-009 | **WORKING** | Stage 3 PARTIAL PASS; Issue #15; Stage 4 **NOT_AUTHORIZED** |
| T-010 | **REVIEW** | Broker Stage 2 DEPLOY_READONLY done; PR #11 Draft |

Параллельно в BACKLOG: Decision System v1 (T-002…T-005, CTO selection).

Оперативный SoR: `bridge/QUEUE.md`.

---

## Выполнено (срез)

- Governance: Constitution, Roles, Principles, Standards, Development Workflow (T-007 DONE).
- Specifications repository (T-008 / DR-0004 DONE).
- Bridge QUEUE/HANDOFF.
- Broker Stage 1–2 (T-010 REVIEW).
- Dify Stage 1–2 + Stage 3 Issue #15 via Broker (T-009 WORKING, PARTIAL PASS).
- SoR record PR #16 merged (merge commit; squash not used).

---

## Выполняется сейчас

T-009 One-Window: после Stage 3 — качество Issue body / Dify bindings; **без** Stage 4 до CEO Authorization.

---

## Следующая задача (не авторизована)

Stage 4 Copilot assignment для Issue #15 — **требует отдельного CEO Authorization**. Не готовить и не запускать без команды CEO.

---

## Блокеры / ограничения

- Stage 4, merge encoding PR, xAI API key, T-009/T-010 → DONE — **не** разрешены.
- Issue #15: пустые «Команда CEO» и «Контекст из GitHub» (Dify binding).
- T-006 BLOCKED.
- CI_NOT_CONFIGURED.

---

## Команда

| Роль | Исполнитель | Статус |
|---|---|---|
| CEO | Человек | активен |
| COO | ChatGPT | активен; без GitHub write |
| Chief Architect | Grok | активен |
| Lead Engineer | GitHub Copilot | активен (DR-0002) |
| CTO (постоянный) | — | вакансия; T-002…T-005 BACKLOG |

---

## Последнее значимое решение в Git

- `decisions/DR-0004.md` — Repository of Approved Specifications.
- Оперативно: staged EA для S-0001/S-0002 (см. specifications + QUEUE).

---

## Правило сессии

Перед работой прочитать:

1. `ACTIVE.md`
2. `governance/Constitution.md`
3. `bridge/QUEUE.md` (если задача из Bridge)
4. релевантную Approved Specification

После значимой работы — обновить Bridge и при необходимости ACTIVE/MEMORY **отдельным** auth, если требуется write.
