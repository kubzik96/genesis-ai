# Genesis Long-Term Project Memory V1

## Status and purpose

**Active — DR-0010 accepted; Memory V1 merged in PR #44.** The accepted model is the canonical operational-memory snapshot. PR [#44](https://github.com/kubzik96/genesis-ai/pull/44) was squash-merged as `2258e312107c9d3d05eb4afb379cfc070e3d26d7`; Issue [#43](https://github.com/kubzik96/genesis-ai/issues/43) is closed as `completed`.

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. This file is a compact recovery index over GitHub evidence; it is not a second Source of Truth and does not replace task, decision, specification, or implementation artifacts.

## Canonical boundaries

| Question | Canonical source |
|---|---|
| What is the cross-session project snapshot? | `MEMORY.md` |
| What task is active, who owns it, and what is its status? | `bridge/QUEUE.md` |
| What context and acceptance criteria were handed to an executor? | `bridge/HANDOFF.md` and the bounded GitHub Issue |
| Why was an architecture or policy choice made? | `decisions/` |
| What are the approved functional requirements? | `specifications/` |
| What was actually implemented, reviewed, and accepted? | Issues, PRs, commits, reviews, and `main` |

If this summary conflicts with a higher-priority or canonical artifact, the canonical artifact wins and an agent must propose a memory correction.

## New-agent recovery protocol

1. Read the exact current `main` HEAD and this file from that HEAD.
2. Compare current `main` with `CURRENT_BASELINE.verified_main`. If newer, inspect the intervening merged PRs/commits for memory-impacting changes before recommending an action.
3. Read `bridge/QUEUE.md` only for current task status and ownership.
4. Read `bridge/HANDOFF.md` only for the assigned task, then follow linked Approved Specifications and active Decision Records.
5. Respect `FAILED_PATHS / DO_NOT_REPEAT` and `CEO_GATES`; chat history never overrides GitHub evidence.
6. Ask the CEO for history only when a material fact cannot be recovered from GitHub or a required decision is genuinely missing.

## CURRENT_STATE

- **One-Window Trial #2:** PASS for GitHub-backed memory recovery and bounded cloud-executor execution through Issue [#48](https://github.com/kubzik96/genesis-ai/issues/48) and PR [#49](https://github.com/kubzik96/genesis-ai/pull/49); it did **not** prove full One-Window transport.
- **Provisional executor:** ChatGPT Work is a proven fallback cloud executor. The preferred v0.1 coding route is the product-native GitHub Issue `@codex` → Codex Cloud path proven in Trials #3 and #4.
- **Accepted handoff discovery:** PR [#47](https://github.com/kubzik96/genesis-ai/pull/47) was independently reviewed, separately authorized Ready, and squash-merged as `60ed769e171aeb146dd61fbf0ae05a6c71069dec`.
- **One-Window Trial #3:** GitHub Issue `@codex` → Codex Cloud launch is proven through Issue [#54](https://github.com/kubzik96/genesis-ai/issues/54); Codex recovered project context from `MEMORY.md`, produced the bounded docs-only result, and the result-page **Create PR** action published PR [#56](https://github.com/kubzik96/genesis-ai/pull/56), later squash-merged as `e545cd07a4c961e3bea48511a963a091fdb7e67c`.
- **One-Window Trial #4:** PASS under S-0007 v0.1. Issue [#65](https://github.com/kubzik96/genesis-ai/issues/65) used exactly one bounded EA and one `@codex` launch; Codex recovered context and produced the requested `MEMORY.md`-only result. Task-side automatic initial PR publication failed without credential expansion; one CEO result-page **Create PR** click published PR [#66](https://github.com/kubzik96/genesis-ai/pull/66), initially non-Draft. The orchestrator restored Draft, exact HEAD was independently reviewed through Issue [#67](https://github.com/kubzik96/genesis-ai/issues/67), Ready and merge were separately authorized, and #66 was squash-merged as `90c30542aa07c837859c3cf8055f092eb536b450`.
- **Genesis Orchestrator v0.1 / T-006:** CEO accepted **DONE** after the post-merge S-0007 acceptance assessment in Issue [#68](https://github.com/kubzik96/genesis-ai/issues/68). This acceptance does not grant any new or continuing Execution Authorization.
- **Production Habit #1 / Genesis Decision Brief v0:** accepted and merged through completed Issue [#71](https://github.com/kubzik96/genesis-ai/issues/71) and PR [#72](https://github.com/kubzik96/genesis-ai/pull/72) as `68d00b960692eed092584bb5cbadb3e37e2a7fc0`. The capability adds a short GitHub-native decision-brief template plus one filled Trial #4/T-006 example. The real run again required one CEO result-page **Create PR** click; publication was initially non-Draft and the orchestrator restored Draft before independent review.
- **Capability boundary:** full zero-click One-Window is still **not proven**. The observed product-native path still requires one CEO **Create PR** click, and Draft preservation is not guaranteed; the orchestrator can restore Draft when supported.
- **S-0007 Revision 1:** Approved by the CEO on 2026-09-03 and merged through PR [#64](https://github.com/kubzik96/genesis-ai/pull/64).
- **Dify:** OPTIONAL / NON-BLOCKING for the One-Window MVP. No Dify operation is required for the next project step.
- **Durability:** GitHub remains the only durable Source of Record. Chats are working memory only.
- **Task status:** T-006 is DONE by explicit CEO acceptance; this snapshot does not promote T-009, T-010, or T-011 to `DONE`; `bridge/QUEUE.md` remains authoritative.

## DONE

- Memory V1 was accepted and merged in PR [#44](https://github.com/kubzik96/genesis-ai/pull/44); DR-0010 is `Принято` and Issue [#43](https://github.com/kubzik96/genesis-ai/issues/43) is closed as `completed`.
- Playbook v0 defined and merged in PR [#40](https://github.com/kubzik96/genesis-ai/pull/40).
- Playbook status synchronized by completed Issue [#41](https://github.com/kubzik96/genesis-ai/issues/41) and squash-merged PR [#42](https://github.com/kubzik96/genesis-ai/pull/42).
- Trial #2 proved GitHub-backed memory recovery by ChatGPT Work through completed Issue [#48](https://github.com/kubzik96/genesis-ai/issues/48) and squash-merged PR [#49](https://github.com/kubzik96/genesis-ai/pull/49) at `2942cedc9fdcbdfcb3c62325370b61b49c844057`.
- The executor-handoff discovery in PR [#47](https://github.com/kubzik96/genesis-ai/pull/47) was independently reviewed, separately authorized Ready, and squash-merged as `60ed769e171aeb146dd61fbf0ae05a6c71069dec`.
- Trial #3 launch/recovery evidence in PR [#56](https://github.com/kubzik96/genesis-ai/pull/56) was independently reviewed through Issue [#57](https://github.com/kubzik96/genesis-ai/issues/57), separately authorized Ready and merge, and squash-merged as `e545cd07a4c961e3bea48511a963a091fdb7e67c`.
- S-0007 Revision 1 was drafted in PR [#62](https://github.com/kubzik96/genesis-ai/pull/62), independently reviewed at exact HEAD, CEO-approved, and promoted to `Approved` in squash-merged PR [#64](https://github.com/kubzik96/genesis-ai/pull/64).
- Trial #4 completed through Issue [#65](https://github.com/kubzik96/genesis-ai/issues/65) and independently reviewed PR [#66](https://github.com/kubzik96/genesis-ai/pull/66), squash-merged as `90c30542aa07c837859c3cf8055f092eb536b450`.
- T-006 / Genesis Orchestrator v0.1 was explicitly accepted by the CEO as DONE after the S-0007 acceptance matrix was recorded in Issue [#68](https://github.com/kubzik96/genesis-ai/issues/68).
- Production Habit #1 / Genesis Decision Brief v0 completed through Issue [#71](https://github.com/kubzik96/genesis-ai/issues/71); PR [#72](https://github.com/kubzik96/genesis-ai/pull/72) was independently reviewed at exact HEAD, separately authorized Ready and merge, and squash-merged as `68d00b960692eed092584bb5cbadb3e37e2a7fc0`.
- Existing specifications, Decision Records, Bridge, Broker code, and Dify plugin candidate remain in GitHub; their presence does not imply runtime authorization.

## KNOWN_BLOCKERS

- **Residual publication click:** Issue → `@codex` → Codex Cloud execution is proven, but the completed result still required one CEO click on the Codex result-page **Create PR** action. Production Habit #1 reproduced the same limitation after Trials #3/#4. Automatic task-side first-PR publication remains unproven.
- **Draft publication semantics:** the proven result-page publication path created Trial #3 PR #56, Trial #4 PR #66, and Production Habit #1 PR #72 as non-Draft despite bounded Draft requirements; the orchestrator corrected them back to Draft. Do not assume Codex result publication preserves Draft by default.
- **Copilot assignment probe:** blocked under the current connector/UI evidence recorded by Issue [#46](https://github.com/kubzik96/genesis-ai/issues/46); revisit only when new capability evidence exists.
- **No custom transport for this blocker:** Dify/Broker/custom transport remains frozen or deferred; do not build new infrastructure merely to remove one manual send.
- **CI:** repository documentation records `CI_NOT_CONFIGURED`; absence of CI is not a passing check.
- **Broker quarantine:** DR-0008 remains active in repository evidence; DR-0009 states that the controlled authenticated check and safe Dify logging confirmation were not completed. Do not infer that quarantine is lifted.

## FAILED_PATHS / DO_NOT_REPEAT

| Path | State | Restart condition |
|---|---|---|
| Dify private plugin `0.1.4` install/upgrade | Frozen after failed-upgrade evidence; not an MVP prerequisite | New Dify/platform-support evidence plus a separately authorized bounded recovery action |
| Raw authenticated Dify HTTP node to Broker | Rejected after the execution-details credential-exposure class recorded in DR-0008/DR-0009 | A new approved security design; never reuse the raw-header pattern by default |
| Local Codex install/local-executor path | Unavailable/failed in the CEO environment; GitHub does not independently prove a recovery | New compatible environment, release, or diagnostic evidence plus a bounded authorization |
| Repeating already verified trial steps | Do not recreate Issue #41 / PR #42 or rerun Trials #3/#4 merely to re-prove Issue→Codex launch/recovery | Only a new, explicitly scoped trial with a new acceptance target |

Failed-path entries are guardrails, not permanent bans. An agent may propose reconsideration only when it cites new evidence and the required CEO gate.

## ACTIVE_DECISIONS

Canonical wording and status remain in `decisions/INDEX.md` and the linked records.

- [DR-0001](decisions/DR-0001.md) — repository architecture.
- [DR-0002](decisions/DR-0002-GitHub-Copilot.md) — GitHub Copilot role.
- [DR-0004](decisions/DR-0004.md) — Approved Specifications repository.
- [DR-0005](decisions/DR-0005-Operational-AI-Team-Roles.md) — operational AI-team roles.
- [DR-0007](decisions/DR-0007-Grok-Limited-Executor.md) — limited Grok executor boundary.
- [DR-0008](decisions/DR-0008-Broker-Token-Exposure-Quarantine.md) — Broker-token quarantine; no repository evidence of CEO removal.
- [DR-0009](decisions/DR-0009-Private-Dify-Broker-Tool-Plugin.md) — typed private plugin architecture; operational use is not implied.
- [DR-0010](decisions/DR-0010-Genesis-Long-Term-Project-Memory-V1.md) — accepted Genesis Long-Term Project Memory V1 model.

## CURRENT_BASELINE

| Field | Value |
|---|---|
| `verified_main` | `68d00b960692eed092584bb5cbadb3e37e2a7fc0` |
| Meaning | Exact accepted `main` after Production Habit #1 / Genesis Decision Brief v0 PR #72 was independently reviewed, separately authorized, and squash-merged |
| Freshness rule | Git history identifies the memory commit itself; do not embed a self-referential future merge SHA. If `main` advances, inspect the delta and update this field after the next meaningful accepted change. |

## NEXT_ACTION

Continue using Genesis Orchestrator v0.1 for real bounded product work and use `docs/decision-brief-template.md` after material accepted changes when a short durable CEO-facing summary is useful. Accumulate evidence from additional real tasks before designing Multi-Agent Advisory or changing the publication path. Keep the residual CEO **Create PR** click and Draft restoration explicit; do not introduce Dify/Broker/custom transport solely to remove that friction. Any xAI reviewer/runtime activation remains separately gated and is not authorized by this memory update.

## CEO_GATES

- Memory content records gates; it never grants or chains them.
- Ready, merge, deployment, secrets operations, Dify operations, Broker HTTP, Cloudflare changes, LIVE activation, and production writes remain separately gated where governance requires.
- A successful step does not authorize the next step.
- Only the CEO can accept task completion and authorize merge.
- Memory maintenance does not give any agent standing write authority. An authorized executor may update memory only inside the current bounded scope or a separately authorized linked docs-only PR.

## OPEN_EXTERNAL_DEPENDENCIES

- A supported product-native Codex result-publication path that removes the remaining CEO **Create PR** click and, ideally, preserves Draft state. Issue→Codex launch, memory recovery, and bounded result production are already proven; Production Habit #1 reproduced the remaining publication/Draft limitation.
- Dify/platform-support or compatibility evidence, but only if the optional plugin path is deliberately resumed.
- A separately authorized controlled non-Dify Broker authentication check and explicit CEO quarantine removal, but only before future authenticated Broker use.

## Agent-owned maintenance contract

The CEO is not the editor or manual carrier of this memory.

Every bounded Issue or task that may change durable project state must declare `Memory impact: YES/NO`. The authorized executor owns the check and the resulting update:

1. Update `MEMORY.md` in the same scoped PR when documentation scope allows it.
2. If the task scope forbids that file, prepare a linked bounded docs-only follow-up Draft PR after the applicable authorization; do not ask the CEO to copy the context.
3. Cite exact Issues, PRs, commits, reviews, DRs, or Specifications. Mark external/CEO-provided facts that GitHub could not independently verify.
4. Update only fields materially changed by evidence; do not reproduce full QUEUE, HANDOFF, DR, Specification, logs, or chat transcripts.
5. Never store credentials, tokens, secret-like values, private execution payloads, or raw sensitive logs.
6. Require independent review of the actual diff and exact HEAD. Merge remains a separate CEO gate.

### Mandatory update triggers

- accepted/merged work changes `CURRENT_STATE`, `DONE`, `CURRENT_BASELINE`, or `NEXT_ACTION`;
- a blocker or external dependency is added, removed, or materially changed;
- a path fails, is frozen, or becomes safe to retry based on new evidence;
- a Decision Record or Approved Specification becomes active, superseded, or archived;
- a CEO gate is granted, consumed, revoked, or remains explicitly pending;
- a security incident, quarantine, deployment state, or end-to-end trial changes the safe next action.

Routine formatting, comments, and changes with no durable project impact do not require a memory update.

## CEO_MANUAL_MAINTENANCE_REQUIRED

**NO.** The CEO supplies decisions and authorizations; agents recover evidence from GitHub and maintain this snapshot through controlled, reviewable PRs.
