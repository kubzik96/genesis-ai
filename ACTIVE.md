# ACTIVE

## Статус проекта

| Поле | Значение |
|---|---|
| Фаза | 2 — Архитектура Genesis AI / One-Window + Grok Executor |
| Статус | Активная разработка |
| Последнее обновление | 2026-08-11 |
| Контрольная точка main | `e14faded46f61d0c32df117ced31480cf1b61062` (после PR #27, S-0005/DR-0007 Approved) |
| Stage 4 encoding squash | `99e6d153ac91b2bf25f9604d58fe51c387ba3d28` (PR #20) |

---

## Главная цель

Построить операционную систему Genesis AI для совместной работы человека и ИИ-агентов.

Практический приоритет текущего этапа: **рабочий One-Window** и ограниченный Grok/xAI executor path (S-0005) как альтернатива недоступному Copilot Cloud Agent.

---

## Текущий спринт

**Genesis One-Window MVP + Limited Grok Executor**

| ID | Статус | Note |
|---|---|---|
| T-009 | **REVIEW** | Stage 4 **PARTIAL PASS**; Issue #19 CLOSED; PR #20 MERGED (`99e6d153…`); not DONE |
| T-010 | **REVIEW** | Broker Stage 2 DEPLOY_READONLY done; PR #11 Draft; not DONE |
| T-011 | **READY** | S-0005 R1 Approved; DR-0007 Accepted; **Stage 1 CODE_AND_TESTS_ONLY EA GRANTED** 2026-08-11 |

Параллельно в BACKLOG: Decision System v1 (T-002…T-005, CTO selection).

Оперативный SoR: `bridge/QUEUE.md`.

### T-011 Stage 1 EA bounds

- **GRANTED:** source + local unit/contract/negative/mock tests + docs в `services/genesis-broker/`, `services/genesis-broker/tests/`, `docs/genesis-broker/`
- **Feature branch + implementation commits + draft PR** — разрешены авторизованному GitHub-исполнителю (чат Grok) как артефакты разработки Stage 1
- **FORBIDDEN for runtime:** новый Broker endpoint, xAI-модель и Dify **не** могут выполнять live GitHub writes на Stage 1
- **FORBIDDEN:** direct `main`, merge, auto-merge, deployment, Cloudflare, secrets operations, live xAI calls, live smoke
- Stage 1 ends at draft PR awaiting independent (non-Grok) review

---

## Выполнено (срез)

- Governance: Constitution, Roles, Principles, Standards, Development Workflow (T-007 DONE).
- Specifications repository (T-008 / DR-0004 DONE).
- Bridge QUEUE/HANDOFF.
- Broker Stage 1–2 (T-010 REVIEW).
- Dify Stage 1–2 + Stage 3 Issue #15 via Broker (PARTIAL PASS).
- Stage 4 encoding fix: Issue #19 CLOSED; PR #20 MERGED squash `99e6d153…` (PARTIAL PASS).
- **S-0004 Approved R1** in main (PR #23) — authoritative Specification for Post-Stage-4 SoR synchronization.
- **S-0003 Revision 1 Superseded** by S-0004.
- **S-0001 Revision 3 Approved** (2026-08-11, PR #27); documents boundary via S-0005; EA NOT_GRANTED by Approval itself.
- **S-0005 Revision 1 Approved** (2026-08-11, PR #27).
- **DR-0007 Accepted** (2026-08-11, PR #27).
- **T-011 registered READY**; Stage 1 CODE_AND_TESTS_ONLY EA granted 2026-08-11.

---

## Выполняется сейчас

**T-011 Stage 1** — CODE_AND_TESTS_ONLY:

- implement `POST /v1/executions/grok/draft-pr` under S-0005 hard limits;
- mocked xAI/GitHub only (runtime path);
- feature branch + implementation commits + draft PR as development artifacts by authorized GitHub executor (Grok chat);
- independent non-Grok review before any further stage.

T-009 / T-010 remain **REVIEW** (not DONE).

---

## Порядок gates (текущий)

1. T-011 Stage 1 implementation on feature branch.
2. Independent (non-Grok) review of Stage 1 draft PR.
3. Separate CEO Authorization for any Stage beyond CODE_AND_TESTS_ONLY.
4. T-009 / T-010 → DONE — **not** authorized by this Stage 1 EA.

---

## Следующие шаги (требуют отдельных Authorization)

- Complete T-011 Stage 1 draft PR + independent review.
- Any deployment / secrets / live path / smoke for Grok executor.
- One-Window technical cycle after further EA.
- T-009 / T-010 acceptance — separate CEO decisions.
- PR B / DR-0006 (Codex) — deferred.

---

## Блокеры / ограничения

- Full One-Window cycle without manual steps — not achieved; T-009 stays REVIEW.
- Original S-0001 success criteria remain open where unchecked.
- T-010 acceptance — separate CEO decision.
- T-006 BLOCKED.
- CI_NOT_CONFIGURED.
- DR-0006 not created (deferred).
- Stage 1 EA does **not** allow runtime live GitHub writes, deployment or smoke.

---

## Команда

| Роль | Исполнитель | Статус |
|---|---|---|
| CEO | Человек | активен |
| COO | ChatGPT | активен; без GitHub write |
| Chief Architect | Grok | активен; limited executor по T-011 Stage 1 EA |
| Lead Engineer | GitHub Copilot | активен (DR-0002); Cloud Agent path unavailable on Free |
| Integration Engineer | Grok / Integration Engineer | T-011 Stage 1 |
| CTO (постоянный) | — | вакансия; T-002…T-005 BACKLOG |
| Codex | — | не формализован; DR-0006 deferred |

---

## Последнее значимое решение в Git

- PR #27 merged (`e14faded…`): S-0001 R3 Approved, S-0005 R1 Approved, DR-0007 Accepted; EA remained NOT_GRANTED by Approval.
- 2026-08-11: CEO granted **Stage 1 CODE_AND_TESTS_ONLY** EA for T-011 (this documentation commit).

---

## Правило сессии

Перед работой прочитать:

1. `ACTIVE.md`
2. `governance/Constitution.md`
3. `bridge/QUEUE.md` / `bridge/HANDOFF.md` (если задача из Bridge)
4. релевантную **Approved** Specification (SoR: **S-0004**; One-Window: **S-0001 R3**; Grok executor: **S-0005 R1**)

После значимой работы — обновить Bridge и при необходимости ACTIVE/MEMORY **отдельным** auth, если требуется write.
