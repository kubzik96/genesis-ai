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
- **Provisional executor:** ChatGPT Work is the provisional proven cloud executor. A fresh Work task recovered the required Genesis context from GitHub Long-Term Project Memory and created bounded GitHub artifacts without a CEO history restatement.
- **Accepted handoff discovery:** PR [#47](https://github.com/kubzik96/genesis-ai/pull/47) was independently reviewed, separately authorized Ready, and squash-merged as `60ed769e171aeb146dd61fbf0ae05a6c71069dec`.
- **Capability boundary:** one manual CEO/orchestrator → Work task send remains necessary. Official OpenAI documentation and the Codex connector response on Draft PR #53 show a product-native GitHub `@codex` route, but the connector requires a Codex environment for this repository; no environment or end-to-end launch is proven.
- **Dify:** OPTIONAL / NON-BLOCKING for the One-Window MVP. No Dify operation is required for the next project step.
- **Durability:** GitHub remains the only durable Source of Record. Chats are working memory only.
- **Task status:** this snapshot does not promote T-009, T-010, or T-011 to `DONE`; `bridge/QUEUE.md` and separate CEO acceptance remain authoritative.

## DONE

- Memory V1 was accepted and merged in PR [#44](https://github.com/kubzik96/genesis-ai/pull/44); DR-0010 is `Принято` and Issue [#43](https://github.com/kubzik96/genesis-ai/issues/43) is closed as `completed`.
- Playbook v0 defined and merged in PR [#40](https://github.com/kubzik96/genesis-ai/pull/40).
- Playbook status synchronized by completed Issue [#41](https://github.com/kubzik96/genesis-ai/issues/41) and squash-merged PR [#42](https://github.com/kubzik96/genesis-ai/pull/42).
- Trial #2 proved GitHub-backed memory recovery by ChatGPT Work through completed Issue [#48](https://github.com/kubzik96/genesis-ai/issues/48) and squash-merged PR [#49](https://github.com/kubzik96/genesis-ai/pull/49) at `2942cedc9fdcbdfcb3c62325370b61b49c844057`.
- The executor-handoff discovery in PR [#47](https://github.com/kubzik96/genesis-ai/pull/47) was independently reviewed, separately authorized Ready, and squash-merged as `60ed769e171aeb146dd61fbf0ae05a6c71069dec`.
- Exact post-trial baseline independently verified at `5c86f03df38004bb638d0bbacfdfeb7f3c1ac557`.
- Existing specifications, Decision Records, Bridge, Broker code, and Dify plugin candidate remain in GitHub; their presence does not imply runtime authorization.

## KNOWN_BLOCKERS

- **Manual executor handoff:** one bounded CEO/orchestrator → ChatGPT Work task send remains necessary and is the primary One-Window blocker.
- **Product-native Issue launch blocked:** the Codex connector recognizes the GitHub `@codex` route but requires a Codex environment for `kubzik96/genesis-ai`. Environment creation and an end-to-end launch probe remain separately gated; do not claim transport solved.
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
| `verified_main` | `7dcef63cdcb71663ff2afd3631f6d4e9da6bb451` |
| Meaning | Exact accepted `main` used as the bounded baseline for Issue #52 product-native launch discovery |
| Freshness rule | Git history identifies the memory commit itself; do not embed a self-referential future merge SHA. If `main` advances, inspect the delta and update this field after the next meaningful accepted change. |

## NEXT_ACTION

Use ChatGPT Work as the provisional cloud executor through one explicit bounded manual CEO/orchestrator → Work send while the product-native route remains blocked. After Issue #52 evidence is reviewed and accepted, the next bounded gate may create the minimum Codex environment for `kubzik96/genesis-ai`; a later separate gate may run one bounded GitHub Issue `@codex` launch probe. Do not implement a custom adapter or reopen Dify/Broker merely to remove this single manual send.

## CEO_GATES

- Memory content records gates; it never grants or chains them.
- Ready, merge, deployment, secrets operations, Dify operations, Broker HTTP, Cloudflare changes, LIVE activation, and production writes remain separately gated where governance requires.
- A successful step does not authorize the next step.
- Only the CEO can accept task completion and authorize merge.
- Memory maintenance does not give any agent standing write authority. An authorized executor may update memory only inside the current bounded scope or a separately authorized linked docs-only PR.

## OPEN_EXTERNAL_DEPENDENCIES

- A minimum Codex cloud environment for `kubzik96/genesis-ai`, followed by a separately authorized end-to-end GitHub Issue `@codex` launch probe; the documented route is not yet approved as the Genesis default.
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
