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

- **One-Window v0:** the FIRST ONE-WINDOW TRIAL completed through bounded Issue [#41](https://github.com/kubzik96/genesis-ai/issues/41), Draft PR, independent Git-artifact review, separate CEO Ready and merge gates, and durable `main` state.
- **Trial result:** PR [#42](https://github.com/kubzik96/genesis-ai/pull/42) was squash-merged; Issue #41 is closed as `completed`.
- **Capability boundary:** the thin GitHub-first cycle is demonstrated, but transfer of the task from ChatGPT/orchestrator to an executor still requires a manual user step. This is the remaining primary One-Window UX blocker.
- **Dify:** OPTIONAL / NON-BLOCKING for the One-Window MVP. No Dify operation is required for the next project step.
- **Durability:** GitHub remains the only durable Source of Record. Chats are working memory only.
- **Task status:** this snapshot does not promote T-009, T-010, or T-011 to `DONE`; `bridge/QUEUE.md` and separate CEO acceptance remain authoritative.

## DONE

- Memory V1 was accepted and merged in PR [#44](https://github.com/kubzik96/genesis-ai/pull/44); DR-0010 is `Принято` and Issue [#43](https://github.com/kubzik96/genesis-ai/issues/43) is closed as `completed`.
- Playbook v0 defined and merged in PR [#40](https://github.com/kubzik96/genesis-ai/pull/40).
- Playbook status synchronized by completed Issue [#41](https://github.com/kubzik96/genesis-ai/issues/41) and squash-merged PR [#42](https://github.com/kubzik96/genesis-ai/pull/42).
- Exact post-trial baseline independently verified at `5c86f03df38004bb638d0bbacfdfeb7f3c1ac557`.
- Existing specifications, Decision Records, Bridge, Broker code, and Dify plugin candidate remain in GitHub; their presence does not imply runtime authorization.

## KNOWN_BLOCKERS

- **Manual executor handoff:** the CEO still has to copy or restate a bounded task between the ChatGPT orchestrator and a coding executor.
- **No approved direct handoff path:** a direct orchestrator-to-executor route has not yet been selected, specified, and proven under existing governance.
- **CI:** repository documentation records `CI_NOT_CONFIGURED`; absence of CI is not a passing check.
- **Broker quarantine:** DR-0008 remains active in repository evidence; DR-0009 states that the controlled authenticated check and safe Dify logging confirmation were not completed. Do not infer that quarantine is lifted.

## FAILED_PATHS / DO_NOT_REPEAT

| Path | State | Restart condition |
|---|---|---|
| Dify private plugin `0.1.4` install/upgrade | Frozen after failed-upgrade evidence; not an MVP prerequisite | New Dify/platform-support evidence plus a separately authorized bounded recovery action |
| Raw authenticated Dify HTTP node to Broker | Rejected after the execution-details credential-exposure class recorded in DR-0008/DR-0009 | A new approved security design; never reuse the raw-header pattern by default |
| Local Codex install/local-executor path | Unavailable/failed in the CEO environment; GitHub does not independently prove a recovery | New compatible environment, release, or diagnostic evidence plus a bounded authorization |
| Repeating already verified trial steps | Do not recreate Issue #41 or PR #42 and do not re-prove their merged facts | Only a new, explicitly scoped trial with a new acceptance target |

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
| `verified_main` | `2258e312107c9d3d05eb4afb379cfc070e3d26d7` |
| Meaning | Exact post-merge `main` used to recover context and verify PR #44 / DR-0010 acceptance at the start of Genesis One-Window Trial #2 |
| Freshness rule | Git history identifies the memory commit itself; do not embed a self-referential future merge SHA. If `main` advances, inspect the delta and update this field after the next meaningful accepted change. |

## NEXT_ACTION

Prepare one bounded GitHub task/specification to remove the manual ChatGPT-to-executor transfer by selecting and proving the smallest direct orchestrator-to-authorized-cloud-executor path. Keep GitHub as the durable task contract and keep Dify non-blocking. No implementation, runtime, deploy, LIVE, or secret action is implied by this memory entry.

Genesis One-Window Trial #2 is the current bounded post-merge memory-sync task. Its result is not recorded in advance. After its Draft PR exists, independent review of the exact HEAD is the next gate; Ready and merge remain separate CEO decisions.

## CEO_GATES

- Memory content records gates; it never grants or chains them.
- Ready, merge, deployment, secrets operations, Dify operations, Broker HTTP, Cloudflare changes, LIVE activation, and production writes remain separately gated where governance requires.
- A successful step does not authorize the next step.
- Only the CEO can accept task completion and authorize merge.
- Memory maintenance does not give any agent standing write authority. An authorized executor may update memory only inside the current bounded scope or a separately authorized linked docs-only PR.

## OPEN_EXTERNAL_DEPENDENCIES

- A direct cloud executor/tool route that the orchestrator can invoke without the CEO manually transferring the task; no route is yet approved as the Genesis default.
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
