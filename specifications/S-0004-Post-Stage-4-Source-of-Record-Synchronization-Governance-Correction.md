# S-0004 — Post-Stage-4 Source of Record Synchronization (Governance Correction)

## Метаданные

| Поле | Значение |
|---|---|
| **ID** | S-0004 |
| **Название** | Post-Stage-4 Source of Record Synchronization (Governance Correction) |
| **Статус** | **In Review** |
| **Revision** | **1** |
| **Автор** | Grok — Chief Architect |
| **Дата создания** | 2026-08-07 |
| **Дата утверждения** | *pending CEO Approval* |
| **Утвердил** | *pending* |
| **Execution Authorization** | **NOT_GRANTED** |
| **Связанные задачи** | T-009, T-010 |
| **Связанные Decision Records** | DR-0004, DR-0005; DR-0006 — требуется при реализации роли Codex |
| **Related Specification** | [S-0003](S-0003-Post-Stage-4-Source-of-Record-Synchronization.md) (Approved Revision 1) |
| **Supersession intent** | После CEO Approval S-0004 **заменяет** S-0003 как действующую Specification для implementation; S-0003 → `Superseded` (только отдельным Approval-действием, не в этом candidate) |

> Candidate **In Review**. Не Approved. Не даёт Execution Authorization.  
> S-0003 Revision 1 остаётся **Approved** до CEO Approval S-0004.  
> EA S-0003 Revision 1 = **TERMINATED** (governance conflict).  
> Новый EA возможен **только** после CEO Approval S-0004 и отдельного решения CEO.

---

## 1. Контекст

S-0003 Revision 1 (Approved, 2026-08-07) определила синхронизацию Source of Record после Stage 4 и кандидатную роль Codex.

После Approval и условного EA обнаружен governance conflict:

1. DR-0004 / `specifications/INDEX.md` требуют обновлять INDEX **в том же commit**, что и Specification.
2. S-0003 §3.1 — **закрытый** список allowed files — **не** включал `specifications/INDEX.md`.
3. Candidate S-0001 Revision 2 не может иметь Status `Approved` до independent review и CEO Approval.
4. Development Workflow §8: изменение Scope (добавление файла в закрытый allowed list) = **Major** → **новая Specification**, не Minor Revision той же S-0003.
5. EA S-0003 Revision 1 **TERMINATED** (Workflow §9).
6. PR #22 (implementation attempt) остаётся Draft без изменений до Approval S-0004 и нового EA.

### 1.1 Подтверждённые Stage 4 факты (без изменения)

- Issue [#19](https://github.com/kubzik96/genesis-ai/issues/19) — CLOSED (`completed`);
- PR [#20](https://github.com/kubzik96/genesis-ai/pull/20) — MERGED (squash);
- squash commit: [`99e6d153ac91b2bf25f9604d58fe51c387ba3d28`](https://github.com/kubzik96/genesis-ai/commit/99e6d153ac91b2bf25f9604d58fe51c387ba3d28);
- changed file: only `bridge/QUEUE.md` (`��` → `в`);
- Stage 4 result: **PARTIAL PASS** (not PASS);
- full One-Window cycle without manual steps: **not achieved**;
- `CI_NOT_CONFIGURED`;
- historical: Stage 4 was **NOT_AUTHORIZED** before separate CEO authorization.

---

## 2. Цель

После CEO Approval **S-0004** и отдельного Execution Authorization:

1. синхронизировать Source of Record с подтверждённым Stage 4 (**PARTIAL PASS**);
2. зафиксировать PR #20, Issue #19, squash `99e6d153…`;
3. T-009 → **REVIEW**, не DONE;
4. T-010 остаётся **REVIEW**;
5. формализовать Codex через DR-0006 + `governance/Roles.md` (дополнение DR-0005);
6. Constitution, Development Workflow, DR-0005 — без изменений;
7. independent review фактического diff + отдельный CEO Merge Authorization до merge.

Цели и factual outcomes **совпадают** с S-0003; меняется только governance-корректный Scope (INDEX + lifecycle S-0001 Rev 2).

---

## 3. Scope

### 3.1 Разрешённые изменения при будущей реализации

Только следующие файлы:

- `specifications/S-0001-Genesis-One-Window-Execution-Spike.md` — Revision 2 по lifecycle §3.1.1;
- `specifications/INDEX.md` — синхронизация S-0001 Revision 2 **в том же commit**, где S-0001 Rev 2 становится `Approved` (DR-0004);
- `bridge/QUEUE.md` — факты Stage 4; T-009 → `REVIEW`; T-010 = `REVIEW`;
- `ACTIVE.md` — текущий фокус и checkpoint `main`;
- `MEMORY.md` — устойчивые факты без секретов;
- `decisions/DR-0006-Codex-Operational-Agent.md` — дополнение DR-0005;
- `decisions/INDEX.md` — регистрация DR-0006;
- `governance/Roles.md` — границы роли Codex.

Рекомендуется **TWO_PRS**:

- **PR A** — SoR sync: S-0001 Rev 2 lifecycle, INDEX, QUEUE, ACTIVE, MEMORY;
- **PR B** — DR-0006 + decisions/INDEX + Roles.

### 3.1.1 Lifecycle S-0001 Revision 2

1. Candidate Status = **`In Review`** (не `Approved`).
2. Independent specification review.
3. Отдельный **CEO Approval** Revision 2.
4. Только после Approval → Status **`Approved`**.
5. `specifications/INDEX.md` обновляется **в том же commit** (DR-0004).
6. S-0004 / S-0003 указываются как Related Specifications, **не** как Decision Records.

### 3.2 Обязательное содержание синхронизации

- Stage 4: `PARTIAL PASS`, не `PASS`;
- T-009: `REVIEW`, не `DONE`;
- T-010: `REVIEW`, не `DONE`;
- PR #20 MERGED; Issue #19 CLOSED; squash `99e6d153…`;
- Copilot runner limitation — ограничение автоматизации, не полный отказ;
- Gate 3 / Gate 4 без трактовки Approve как auto-merge;
- `CI_NOT_CONFIGURED`;
- историческое `Stage 4 NOT_AUTHORIZED` — только как прошлое.

### 3.3 Codex / DR-0006 (без изменения границ S-0003)

**Codex Operational Agent** — дополняет DR-0005, не заменяет.

Ограничения (обязательны):

- не CEO / COO / CTO / Chief Architect / Lead Engineer / Independent Reviewer по умолчанию;
- нет постоянного GitHub write, EA или Merge Authorization;
- write только по явному ограниченному CEO Authorization;
- запрет direct `main`, auto-merge, merge без CEO Merge Authorization;
- запрет быть единственным independent reviewer собственной работы;
- не переписывает DR-0005; не меняет Constitution;
- секреты не в Git / чат.

### 3.4 Вне Scope

- Constitution; Development Workflow; Principles; Standards; Vision; Roadmap;
- HANDOFF / архитектура Bridge;
- T-006; T-009/T-010 → DONE;
- CTO selection; long-term platform;
- Broker / Dify / Cloudflare / secrets / permissions;
- One-Window feature implementation beyond SoR sync;
- direct `main`; auto-merge; merge без CEO Merge Authorization.

---

## 4. Требования

1. Evidence-first: только Git-артефакты.
2. Consistency: S-0001, INDEX, QUEUE, ACTIVE, MEMORY согласованы.
3. INDEX согласован со Status/Revision каждой Specification (DR-0004).
4. Approval Specification ≠ Execution Authorization.
5. Implementation только после EA на **Approved** S-0004.
6. Independent review по актуальному HEAD/diff.
7. Ready ≠ merge permission; merge только с CEO Merge Authorization.
8. EA прекращается при ошибке Spec / scope expansion / указании CEO (Workflow §9).

---

## 5. Dependencies

- Constitution; Development Workflow Revision 2;
- DR-0004; DR-0005;
- S-0003 Revision 1 (Approved; to be Superseded only after S-0004 Approval);
- Issue #19; PR #20; commit `99e6d153…`;
- independent review of this S-0004 candidate;
- separate CEO decisions: Approval S-0004, EA, Merge Authorization.

---

## 6. Assumptions

- S-0003 Rev 1 остаётся Approved в `main` до Approval S-0004;
- PR #22 Draft не изменяется этим candidate PR;
- T-009/T-010 не DONE без отдельных решений CEO;
- CI may remain `CI_NOT_CONFIGURED`.

---

## 7. Acceptance Criteria (implementation after EA)

- [ ] Only §3.1 files changed.
- [ ] Stage 4 = PARTIAL PASS.
- [ ] T-009 = REVIEW, not DONE.
- [ ] T-010 = REVIEW, not DONE.
- [ ] PR #20 / Issue #19 / `99e6d153…` recorded.
- [ ] S-0001 Rev 2 completed lifecycle §3.1.1.
- [ ] INDEX synced with Approved S-0001 Rev 2 same commit.
- [ ] CI_NOT_CONFIGURED explicit.
- [ ] Historical Stage 4 NOT_AUTHORIZED preserved as history only.
- [ ] DR-0006 supplements DR-0005; Roles updated; Codex boundaries held.
- [ ] Constitution / DW / DR-0005 / HANDOFF unchanged.
- [ ] No secrets.
- [ ] Feature branch + PR (TWO_PRS preferred).
- [ ] Independent review of HEAD/diff.
- [ ] No merge without CEO Merge Authorization.
- [ ] Post-merge verification before any DONE.

---

## 8. Verification

1. GitHub evidence: Issue #19, PR #20, `99e6d153…`.
2. Changed files ⊆ §3.1.
3. Cross-check S-0001, INDEX, QUEUE, ACTIVE, MEMORY.
4. DR-0006 / Roles vs §3.3.
5. Diff excludes Constitution, DW, DR-0005, HANDOFF, secrets.
6. Independent verdict on current HEAD.
7. Post-merge re-read from `main`.

---

## 9. Expected artifacts

- Synchronized SoR after Stage 4;
- S-0001 Rev 2 + INDEX aligned;
- QUEUE / ACTIVE / MEMORY consistent;
- DR-0006 + Roles;
- implementation PR links + reviews + post-merge verification;
- no Constitution / DW / DR-0005 changes.

---

## 10. Decision Records

- [x] DR-0006 required (Codex role formalization).
- [x] DR-0006 supplements DR-0005.
- [ ] Approval of S-0004 does not create/accept DR-0006.
- [ ] After CEO Approval S-0004: S-0003 → Superseded (separate metadata action).

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Treat S-0003 Rev2 as valid | Explicit: Major Scope change → S-0004; S-0003 Rev1 unchanged until Superseded |
| INDEX drift | INDEX in §3.1; same-commit rule |
| Premature Approved on S-0001 Rev 2 | §3.1.1 lifecycle |
| T-009 → DONE | Explicit REVIEW only |
| Codex over-scope | §3.3 boundaries |
| EA under S-0003 Rev1 | TERMINATED; new EA only after S-0004 Approval |

---

## 12. History

| Revision | Date | Author | Status | Change |
|---|---|---|---|---|
| 1 | 2026-08-07 | Grok — Chief Architect | **In Review** | New Specification: governance correction of S-0003 Scope (INDEX + S-0001 Rev 2 lifecycle); supersession intent after Approval; goals/outcomes unchanged |
