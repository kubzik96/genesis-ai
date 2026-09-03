# DR-0010 — Genesis Long-Term Project Memory V1

## Status

**Принято**

Accepted by explicit CEO decision on 2026-09-03. Ready and merge remain separate CEO gates. This acceptance grants no standing authority.

## Date

2026-09-02

## Context

GitHub is already the Genesis Source of Record, and the repository already contains `MEMORY.md`, `ACTIVE.md`, `bridge/QUEUE.md`, `bridge/HANDOFF.md`, Decision Records, Specifications, and Git implementation evidence.

The current root memory files were last synchronized against August baselines and now omit the completed FIRST ONE-WINDOW TRIAL, Issue #41, PR #42, the Dify non-blocking decision, frozen/failed paths, and the remaining manual executor-handoff blocker. A new agent can therefore read GitHub and still be directed by stale summaries.

Creating a vector database, RAG service, Dify memory, or separate database would introduce another state store before the minimal GitHub-first path is exhausted. Duplicating the full QUEUE, HANDOFF, DR, or Specification content in a new memory tree would create conflicting canonical copies.

Development Workflow §16 requires a Decision Record when the memory model changes.

## Decision

Adopt the following minimal Memory V1 model after separate acceptance and merge:

1. Root `MEMORY.md` is the single canonical **operational-memory snapshot** for rapid cross-session recovery.
2. GitHub remains the only durable Source of Record; Memory V1 is an evidence-linked index, not an independent truth store.
3. `bridge/QUEUE.md` remains canonical for task status and ownership.
4. `bridge/HANDOFF.md` and bounded Issues remain canonical for executor context and acceptance criteria.
5. Decision Records remain canonical for why/policy; Approved Specifications remain canonical for functional requirements; Git artifacts remain canonical for implementation evidence.
6. `ACTIVE.md` becomes a small compatibility entry point and no longer carries a separately maintained state snapshot.
7. Memory V1 uses the fixed recovery fields `CURRENT_STATE`, `DONE`, `KNOWN_BLOCKERS`, `FAILED_PATHS / DO_NOT_REPEAT`, `ACTIVE_DECISIONS`, `CURRENT_BASELINE`, `NEXT_ACTION`, `CEO_GATES`, and `OPEN_EXTERNAL_DEPENDENCIES`.
8. Each meaningful task declares `Memory impact: YES/NO`; the authorized executor, not the CEO, owns evidence recovery and any required memory update.
9. Updates occur in the same scoped PR when authorized, or in a separately authorized linked docs-only Draft PR. Independent diff/HEAD review and separate CEO merge authorization remain mandatory.
10. No credentials, secret-like values, private payloads, raw sensitive logs, or chat transcripts are stored.

## New-agent recovery rule

A new Genesis agent reads current `main` and `MEMORY.md`, checks whether `main` advanced beyond the memory baseline, inspects only the relevant delta, then follows QUEUE/HANDOFF and linked controlling records. It must not ask the CEO to repeat recoverable history and must not retry a failed path without new evidence and the required gate.

## Update triggers

Memory must be reviewed after meaningful accepted changes to state/baseline/next action, blockers or dependencies, failed/frozen paths, active DRs or Specifications, CEO gates, security/quarantine state, deployments, or end-to-end trials. No-impact edits do not require churn.

## Consequences

### Positive

- new chats recover the current operating picture from one short GitHub entry point;
- failed paths become durable guardrails with explicit restart conditions;
- the CEO supplies decisions but does not manually edit or shuttle memory;
- existing canonical artifacts keep their responsibilities;
- no new runtime infrastructure or external database is introduced.

### Trade-offs

- agents must perform a memory-impact check during meaningful work;
- the snapshot can still become stale if an executor violates the update contract;
- freshness is verified through Git history and linked evidence rather than an impossible self-referential embedded merge SHA.

## Rejected alternatives

- Vector DB/RAG/Dify memory/separate database: premature and creates another state authority.
- Keep both `ACTIVE.md` and `MEMORY.md` as full snapshots: duplicates state and already produced drift.
- Put all task history in `MEMORY.md`: duplicates QUEUE/HANDOFF and makes recovery slower.
- Require CEO manual maintenance: preserves the current UX failure and makes continuity depend on copying context between chats.

## Authority boundary

This proposal does not modify the Constitution, Development Workflow, roles, existing Decision Records, Approved Specifications, or CEO gates. It authorizes no Ready, merge, deployment, secret operation, Dify operation, Broker HTTP, Cloudflare change, LIVE activation, or production code.

## Related evidence

- Issue #41 and PR #42 — completed FIRST ONE-WINDOW TRIAL evidence.
- `docs/one-window-mvp-playbook-v0.md` — GitHub-first thin path and Dify optional/non-blocking boundary.
- `bridge/QUEUE.md` / `bridge/HANDOFF.md` — retained task and handoff responsibilities.
- `governance/Constitution.md` / `governance/DevelopmentWorkflow.md` — Source-of-Record hierarchy and gates.
- DR-0008 / DR-0009 — authenticated Dify/Broker failed-path and quarantine evidence.
