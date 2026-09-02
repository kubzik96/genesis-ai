# Genesis One-Window MVP Playbook v0

## Status

**Draft — implementation playbook only.**

This document narrows the existing Genesis One-Window work to the shortest useful MVP path. It does not itself authorize runtime execution, merge, deployment, secret operations, LIVE activation, or authenticated writes.

## Goal

Prove one reproducible task cycle from one CEO-facing orchestrator session:

`CEO task → GitHub context → Issue → coding agent → Draft PR → independent review → CEO decision → durable GitHub state`

The MVP is successful only after one real end-to-end trial completes this path under the existing authorization boundaries. Until then, One-Window remains **PARTIAL / not PASS**.

## System of Record and Memory V1

GitHub remains the Genesis System of Record.

Memory V1 is deliberately simple:

- `bridge/QUEUE.md` records active work and status;
- `bridge/HANDOFF.md` records explicit task handoff/context when needed;
- approved specifications and Decision Records preserve durable architecture and policy;
- PRs, commits, reviews, and accepted evidence preserve implementation history.

The orchestrator chat/session is working memory, not an independent System of Record. Durable decisions or state that must survive the session are written to the repository only through an authorized GitHub change.

No vector database, semantic-memory service, or autonomous long-term memory is required for MVP.

## Orchestrator role

ChatGPT/Genesis acts as the CEO-facing orchestrator/manager for the MVP. It may:

1. understand and structure the CEO task;
2. read authorized GitHub context;
3. propose decomposition and routing;
4. prepare an Issue/task specification;
5. route coding work to Copilot/Codex or another separately authorized coding agent;
6. collect the resulting Git artifacts;
7. request an independent review from Grok or another reviewer that did not author the change being reviewed;
8. compare claims against the actual Issue, PR diff, HEAD, changed-file set, and review evidence;
9. present one coherent result and the next required CEO decision.

The orchestrator has **no standing authority** to merge, deploy, access/change secrets, enable LIVE behavior, or perform other consequential actions. Existing CEO gates remain authoritative.

## Thin MVP path

### 1. CEO task

The CEO states one bounded task in the orchestrator session.

The orchestrator identifies the goal, acceptance criteria, relevant repository context, proposed executor, and any consequential boundary that will require a later CEO gate.

### 2. GitHub context

Use GitHub as the primary durable context source. Read only the minimum relevant specifications, Decision Records, QUEUE/HANDOFF state, and current implementation artifacts.

Broker read contracts may be used when separately authorized and useful, but are not required for this MVP path.

### 3. Issue

The orchestrator prepares a structured Issue body from the verified context. Issue creation is a write and occurs only under the applicable authorization.

The Issue becomes the bounded task contract for the coding agent; chat instructions alone must not silently replace durable task state.

### 4. Coding agent

Coding work is routed to Copilot/Codex or another explicitly authorized coding agent. The expected development artifact is a feature branch and Draft PR, subject to the scope and gates of the task.

### 5. Independent review

At least one independent reviewer channel is required when a review is claimed. Grok or another suitable reviewer may perform this role, but an agent must not be the sole reviewer of its own change.

Review must inspect Git artifacts rather than rely only on the coding agent's summary. At minimum, verify the PR HEAD, changed files, relevant diff, scope, and acceptance criteria.

### 6. CEO decision

The orchestrator summarizes verified evidence, unresolved risks, and the exact consequential action awaiting authorization.

Merge, deployment, secrets operations, LIVE activation, and other consequential actions remain behind the existing CEO gates. No playbook step implies authorization for the next step.

### 7. Durable state

After an authorized/accepted result, the relevant GitHub System-of-Record state is updated so that a future session can recover the task outcome without relying on chat history alone.

## Dify status for MVP

Dify is **OPTIONAL / NON-BLOCKING** for Genesis One-Window MVP.

The private Genesis Broker Tool Plugin `0.1.4` installation path remains frozen after the existing failed-upgrade evidence. There is no install/retry authorization in this playbook.

Dify may be resumed later after platform/support guidance or another separately approved recovery path. A Dify failure must not block proving the thin One-Window MVP through GitHub and authorized agent channels.

## Existing components retained

The MVP keeps, rather than replaces:

- GitHub as System of Record;
- existing specifications and Decision Records;
- `QUEUE.md` / `HANDOFF.md` Bridge discipline;
- existing CEO authorization gates;
- fail-closed secret and credential handling;
- Broker capabilities when separately authorized and useful;
- the S-0001 acceptance intent: one task progresses through durable task state, implementation artifact, independent review, and CEO decision without auto-merge.

## Deferred from MVP

The following are explicitly non-goals for this first working path:

- formal multi-agent debates or voting protocols;
- advanced vector/semantic memory;
- complex Dify workflows;
- Dify private-plugin recovery as an MVP prerequisite;
- elaborate autonomous governance beyond existing repository policy and CEO gates;
- automatic multi-agent tool mesh;
- LIVE Grok executor or broader write authority without separate authorization.

These may be revisited after the thin path works reproducibly.

## Verification and honesty rule

One-Window is not declared **PASS** merely because individual components exist.

For MVP PASS, one bounded real task must demonstrate, with Git evidence:

1. task received in one CEO-facing orchestrator session;
2. relevant GitHub context read;
3. durable Issue/task contract created under authorization;
4. coding agent produces the expected Draft PR;
5. independent reviewer checks the actual Git artifacts;
6. orchestrator reports verified evidence and asks for the applicable CEO decision;
7. accepted outcome is recoverable from GitHub durable state;
8. Dify is not required for completion of the cycle.

Manual orchestration is acceptable for v0, but any remaining manual handoff must be reported honestly. A partial cycle remains **PARTIAL**, not PASS.

## Safety and authorization boundaries

This playbook does not weaken existing governance.

In particular:

- no implicit authorization chaining between steps;
- no auto-merge;
- no silent credential reuse or exposure;
- no secret, deploy, LIVE, or authenticated-write expansion without its required CEO gate;
- no speculative retries after fail-closed errors;
- Dify plugin `0.1.4` remains frozen unless separately authorized;
- durable repository changes occur only through an authorized GitHub path.

## First trial after approval

After this playbook is reviewed and explicitly approved, the next phase is a **separately authorized** end-to-end trial using one small real Genesis task.

This document does not authorize that trial.