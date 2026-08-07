# ACTIVE

## Статус проекта

| Поле | Значение |
|---|---|
| Фаза | 2 — Архитектура Genesis AI / One-Window spike |
| Статус | Активная разработка |
| Последнее обновление | 2026-08-07 |
| Контрольная точка main | `fced49eff5fd88cece5159a4902bd14e989e390d` (после PR #21, S-0003 Approved) |
| Stage 4 encoding squash | `99e6d153ac91b2bf25f9604d58fe51c387ba3d28` (PR #20) |

---

## Главная цель

Построить операционную систему Genesis AI для совместной работы человека и ИИ-агентов.

---

## Текущий спринт

**Genesis One-Window MVP** (S-0001 Revision 2 / S-0002 / S-0003)

| ID | Статус | Note |
|---|---|---|
| T-009 | **REVIEW** | Stage 4 **PARTIAL PASS**; Issue #19 CLOSED; PR #20 MERGED (`99e6d153…`); not DONE |
| T-010 | **REVIEW** | Broker Stage 2 DEPLOY_READONLY done; PR #11 Draft; not DONE |

Параллельно в BACKLOG: Decision System v1 (T-002…T-005, CTO selection).

Оперативный SoR: `bridge/QUEUE.md`.

---

## Выполнено (срез)

- Governance: Constitution, Roles, Principles, Standards, Development Workflow (T-007 DONE).
- Specifications repository (T-008 / DR-0004 DONE).
- Bridge QUEUE/HANDOFF.
- Broker Stage 1–2 (T-010 REVIEW).
- Dify Stage 1–2 + Stage 3 Issue #15 via Broker (PARTIAL PASS).
- Stage 4 encoding fix: Issue #19 CLOSED; PR #20 MERGED squash `99e6d153…` (PARTIAL PASS — full One-Window automation not achieved).
- S-0003 Approved in main (PR #21, `fced49eff5…`) — SoR sync + Codex role definition (implementation staged).

---

## Выполняется сейчас

S-0003 PR A — Source-of-Record synchronization (this change set): align S-0001 / QUEUE / ACTIVE / MEMORY with Stage 4 facts. T-009 → REVIEW. DR-0006 / Roles — separate PR B (not this PR).

---

## Следующие шаги (требуют отдельных Authorization)

- Independent review + CEO Merge Authorization for S-0003 PR A.
- PR B: DR-0006 (Codex Operational Agent) + `governance/Roles.md`.
- T-009 / T-010 → DONE — **not** authorized by S-0003 EA.

---

## Блокеры / ограничения

- Full One-Window cycle without manual steps — not achieved; T-009 stays REVIEW.
- T-010 acceptance — separate CEO decision.
- T-006 BLOCKED.
- CI_NOT_CONFIGURED.
- DR-0006 not yet created (PR B).

---

## Команда

| Роль | Исполнитель | Статус |
|---|---|---|
| CEO | Человек | активен |
| COO | ChatGPT | активен; без GitHub write |
| Chief Architect | Grok | активен |
| Lead Engineer | GitHub Copilot | активен (DR-0002) |
| CTO (постоянный) | — | вакансия; T-002…T-005 BACKLOG |
| Codex | — | не формализован до DR-0006 |

---

## Последнее значимое решение в Git

- `specifications/S-0003-…` — Approved (PR #21).
- Stage 4 PARTIAL PASS evidence: Issue #19, PR #20, commit `99e6d153…`.

---

## Правило сессии

Перед работой прочитать:

1. `ACTIVE.md`
2. `governance/Constitution.md`
3. `bridge/QUEUE.md` (если задача из Bridge)
4. релевантную Approved Specification

После значимой работы — обновить Bridge и при необходимости ACTIVE/MEMORY **отдельным** auth, если требуется write.
