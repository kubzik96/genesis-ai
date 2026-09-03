# Genesis Long-Term Project Memory V1

## Status and purpose

**Active — DR-0010 accepted; Memory V1 merged in PR #44.** GitHub `kubzik96/genesis-ai` remains the durable Source of Record. This file is a compact recovery index over GitHub evidence; it is not a second Source of Truth and does not replace task, decision, specification, or implementation artifacts.

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

- **Genesis Orchestrator v0.1 / T-006:** CEO accepted **DONE** after S-0007 Revision 1 and Trial #4. The preferred bounded coding route is GitHub Issue `@codex` → Codex Cloud; one CEO result-page **Create PR** click is still required in the proven path and Draft preservation is not guaranteed.
- **Production Habit #1 / Genesis Decision Brief v0:** accepted and merged through Issue #71 and PR #72 as `68d00b960692eed092584bb5cbadb3e37e2a7fc0`.
- **Production Habit #2 / Genesis Task Intake / Execution Brief:** work exists in Draft PR #78; no Ready/merge is implied by this snapshot.
- **S-0008 Revision 1 — Genesis Independent Grok Reviewer v0.1:** CEO-approved on 2026-09-03 against independently reviewed HEAD `0cdf9b50287e1c1250cbcd2fdcb4c3ab25f0023d`. The approved reviewer contract is separate from the S-0005 writer/executor contract, exact-HEAD bound, fail-closed, secret-free toward Grok/xAI, and grants Grok/xAI zero GitHub write authority. Consequential-gate reviewer evidence must be durably recorded in GitHub by the trusted Genesis side with the exact reviewed HEAD before use.
- **DR-0011 — Genesis Independent Grok Reviewer:** CEO-accepted on 2026-09-03. It establishes the reviewer-only architecture boundary and preserves GitHub as SoR, Genesis as control boundary, actor independence, and DR-0008 quarantine/default-off restrictions.
- **S-0008 Execution Authorization:** **NOT_GRANTED**. Approval/acceptance does not authorize implementation, Codex launch, xAI calls, authenticated Broker use, secrets, Dify/Cloudflare, deploy/LIVE, Ready, or merge.
- **Qodo:** temporary independent review scaffolding during its trial; it is not a permanent Genesis dependency.
- **Dify:** OPTIONAL / NON-BLOCKING and frozen unless separately authorized.
- **Durability:** GitHub remains the only durable Source of Record. Chats are working memory only.

## DONE

- Memory V1 was accepted and merged in PR #44; DR-0010 is `Принято`.
- Playbook v0 and its synchronization were merged through PRs #40 and #42.
- Trials #2–#4 proved GitHub-backed recovery and the product-native Issue→Codex execution route; they did not prove zero-click publication.
- S-0007 Revision 1 was independently reviewed, CEO-approved, and promoted to `Approved`; T-006 / Genesis Orchestrator v0.1 was explicitly accepted DONE.
- Production Habit #1 / Genesis Decision Brief v0 was independently reviewed, separately authorized Ready/merge, and merged through PR #72.
- DR-0011 and S-0008 Revision 1 have completed independent architecture/spec review and explicit CEO acceptance/approval; their controlled docs promotion is the current bounded work. No implementation authority follows from those decisions.

## KNOWN_BLOCKERS

- **Residual publication click:** Issue → `@codex` → Codex Cloud execution is proven, but completed runs still required one CEO click on the Codex result-page **Create PR** action. Automatic task-side first-PR publication remains unproven.
- **Draft publication semantics:** proven result-page publication has created PRs as non-Draft; the orchestrator can restore Draft when supported. Do not assume Draft preservation.
- **Copilot assignment probe:** blocked under current connector/UI evidence; revisit only when new capability evidence exists.
- **No custom transport for publication friction:** do not build Dify/Broker/custom transport merely to remove the one publication click.
- **CI:** repository documentation records `CI_NOT_CONFIGURED`; absence of CI is not a passing check.
- **Broker quarantine:** DR-0008 remains active. Do not infer that quarantine is lifted.
- **Independent Grok Reviewer runtime:** architecture/specification is approved, but implementation EA, authenticated Broker use, secrets operations, deployment, and first LIVE xAI call remain separately blocked pending explicit CEO gates.

## FAILED_PATHS / DO_NOT_REPEAT

| Path | State | Restart condition |
|---|---|---|
| Dify private plugin `0.1.4` install/upgrade | Frozen after failed-upgrade evidence; not an MVP prerequisite | New Dify/platform-support evidence plus a separately authorized bounded recovery action |
| Raw authenticated Dify HTTP node to Broker | Rejected after the execution-details credential-exposure class recorded in DR-0008/DR-0009 | A new approved security design; never reuse the raw-header pattern by default |
| Local Codex install/local-executor path | Unavailable/failed in the CEO environment | New compatible environment/release/evidence plus bounded authorization |
| Repeating already verified trial steps | Do not rerun Trials #3/#4 merely to re-prove Issue→Codex launch/recovery | Only a new explicitly scoped acceptance target |
| Reusing S-0005 writer authority as S-0008 reviewer authority | Forbidden by S-0008/DR-0011 separation | A new/revised approved architecture decision; do not inherit writer authority for convenience |

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
- [DR-0011](decisions/DR-0011-Genesis-Independent-Grok-Reviewer.md) — accepted independent Grok/xAI reviewer-only architecture; no implementation/LIVE authority implied.

## CURRENT_BASELINE

| Field | Value |
|---|---|
| `verified_main` | `7cf13c17ccc3a2102de2f547b5b5bf5594dbdf34` |
| Meaning | Exact verified `main` before the current S-0008/DR-0011 docs-promotion PR; includes accepted Production Habit #1 memory synchronization through PR #74 |
| Freshness rule | Git history identifies the memory commit itself; do not embed a self-referential future merge SHA. If `main` advances, inspect the delta and update this field after the next meaningful accepted change. |

## NEXT_ACTION

Complete independent exact-HEAD review and the separate Ready/merge gates for the bounded S-0008/DR-0011 docs promotion. After that, the next consequential step is a **separate CEO Execution Authorization** for a minimum reviewer-only implementation. The future implementation must keep Grok/xAI zero-write, preserve DR-0008 quarantine/default-off, and require durable GitHub persistence of consequential-gate review evidence by the trusted Genesis side before use. No xAI LIVE call, authenticated Broker use, secrets operation, deploy, or quarantine removal is authorized by this memory update.

## CEO_GATES

- Memory content records gates; it never grants or chains them.
- S-0008 Specification Approval and DR-0011 acceptance are recorded; **Execution Authorization remains NOT_GRANTED**.
- Ready, merge, implementation EA, deployment, secrets operations, Dify operations, authenticated Broker use, Cloudflare changes, first xAI LIVE call, and quarantine removal remain separately gated where governance requires.
- A successful step does not authorize the next step.
- Only the CEO can accept task completion and authorize merge.
- Memory maintenance does not give any agent standing write authority.

## OPEN_EXTERNAL_DEPENDENCIES

- A supported product-native Codex result-publication path that removes the remaining CEO **Create PR** click and ideally preserves Draft state.
- A permanent independent-review path replacing temporary Qodo: S-0008/DR-0011 define the approved architecture, but implementation and LIVE proof remain separately gated.
- Dify/platform-support or compatibility evidence only if the optional plugin path is deliberately resumed.
- A separately authorized controlled non-Dify Broker authentication check and explicit CEO quarantine removal, only before future authenticated Broker use.

## Agent-owned maintenance contract

The CEO is not the editor or manual carrier of this memory. Every bounded Issue or task that may change durable project state must declare `Memory impact: YES/NO`. The authorized executor owns the check and resulting update.

Mandatory update triggers include accepted/merged work changing current state/baseline/next action; material blockers; active Decision Records or Approved Specifications; CEO gates; security/quarantine/deployment state; and end-to-end trial evidence. Never store credentials, tokens, secret-like values, private execution payloads, or raw sensitive logs. Require independent review of the actual diff and exact HEAD. Merge remains a separate CEO gate.

## CEO_MANUAL_MAINTENANCE_REQUIRED

**NO.** The CEO supplies decisions and authorizations; agents recover evidence from GitHub and maintain this snapshot through controlled, reviewable PRs.
