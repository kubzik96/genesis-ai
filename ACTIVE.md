# ACTIVE

## Статус проекта

| Поле | Значение |
|---|---|
| Фаза | 2 — Архитектура Genesis AI / One-Window spike |
| Статус | Активная разработка |
| Последнее обновление | 2026-08-07 |
| Контрольная точка main | `0c7ecbff2487ef09a36f1156dbced722ab62a114` (после PR #23, S-0004 Approved) |
| Stage 4 encoding squash | `99e6d153ac91b2bf25f9604d58fe51c387ba3d28` (PR #20) |

---

## Главная цель

Построить операционную систему Genesis AI для совместной работы человека и ИИ-агентов.

Практический приоритет текущего этапа: **рабочий One-Window** (CEO → один интерфейс → агенты → PR → review → решения CEO).

---

## Текущий спринт

**Genesis One-Window MVP** (S-0001 Approved R2 / S-0002 / S-0004)

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
- Stage 4 encoding fix: Issue #19 CLOSED; PR #20 MERGED squash `99e6d153…` (PARTIAL PASS — full One-Window automation not achieved; original S-0001 success criteria not weakened).
- **S-0004 Approved R1** in main (PR #23, `0c7ecbff…`) — authoritative Specification for Post-Stage-4 SoR synchronization.
- **S-0003 Revision 1 Superseded** by S-0004.
- **S-0001 Revision 2 Approved** (2026-08-07) after independent specification review (BLOCKERS NONE) + CEO Approval; INDEX synced in same commit.

---

## Выполняется сейчас

**S-0004 PR A** — Source-of-Record synchronization (PR #22 Draft):

- S-0001 Revision 2 = **Approved**;
- independent specification review = **completed**;
- CEO Approval Revision 2 = **completed**;
- INDEX sync = **completed in this commit**;
- QUEUE / ACTIVE / MEMORY aligned with Stage 4 PARTIAL PASS and S-0004.

**DR-0006 / PR B** — deferred; **not** blocking One-Window critical path.

---

## Порядок gates (текущий)

1. ~~Independent Specification Review S-0001 Revision 2~~ — **done**.
2. ~~CEO Approval S-0001 Revision 2~~ — **done**.
3. ~~INDEX sync (same approval commit)~~ — **done**.
4. **Independent implementation review** of current PR #22 HEAD (SoR files + Approved Spec state).
5. **Separate CEO Merge Authorization** for PR A.
6. **Merge** PR #22 + post-merge verification.
7. **Next One-Window technical cycle** (product work).

---

## Следующие шаги (требуют отдельных Authorization)

- Complete gates 4–6 above in order.
- One-Window technical cycle after post-merge verification.
- PR B / DR-0006 (Codex) — after next One-Window cycle (deferred).
- T-009 / T-010 → DONE — **not** authorized by S-0004 PR A EA or by S-0001 Rev2 Approval.

---

## Блокеры / ограничения

- Full One-Window cycle without manual steps — not achieved; T-009 stays REVIEW.
- Original S-0001 success criteria remain open where unchecked (not redefined by PARTIAL PASS).
- T-010 acceptance — separate CEO decision.
- T-006 BLOCKED.
- CI_NOT_CONFIGURED.
- DR-0006 not created (deferred).

---

## Команда

| Роль | Исполнитель | Статус |
|---|---|---|
| CEO | Человек | активен |
| COO | ChatGPT | активен; без GitHub write |
| Chief Architect | Grok | активен |
| Lead Engineer | GitHub Copilot | активен (DR-0002) |
| CTO (постоянный) | — | вакансия; T-002…T-005 BACKLOG |
| Codex | — | не формализован; DR-0006 deferred |

---

## Последнее значимое решение в Git

- S-0001 Revision 2 — **Approved** (2026-08-07) in PR #22 (this commit).
- `specifications/S-0004-…` — **Approved** (PR #23, squash `0c7ecbff…`).
- S-0003 Revision 1 — **Superseded** by S-0004.
- Stage 4 PARTIAL PASS evidence: Issue #19, PR #20, commit `99e6d153…`.

---

## Правило сессии

Перед работой прочитать:

1. `ACTIVE.md`
2. `governance/Constitution.md`
3. `bridge/QUEUE.md` (если задача из Bridge)
4. релевантную **Approved** Specification (SoR path: **S-0004**; One-Window: **S-0001 R2**)

После значимой работы — обновить Bridge и при необходимости ACTIVE/MEMORY **отдельным** auth, если требуется write.
