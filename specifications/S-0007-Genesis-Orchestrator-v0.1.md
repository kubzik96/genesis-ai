# S-0007 — Genesis Orchestrator v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0007 |
| Title | Genesis Orchestrator v0.1 |
| Status | Approved |
| Revision | 1 |
| Task | T-006 — Implement Orchestrator v0.1 |
| Related Issues | #45, #52, #54, #55, #61 |
| Related Decisions | DR-0004, DR-0005, DR-0010 |
| Author | ChatGPT — COO / temporary CTO |
| Date | 2026-09-03 |
| Approved | 2026-09-03 — CEO Genesis AI |
| Execution Authorization | NOT_GRANTED |

> **Revision 1 — Approved** by CEO Genesis AI on 2026-09-03 after independent exact-HEAD architecture/spec review of PR #62 (`6aa69818c1aba7fc0a0ff6f735ebaeca120ae595`). Approval does not grant Execution Authorization for Trial #4 or implementation, deployment, secrets, runtime writes, or any change to T-006 status.

## 1. Context

Genesis has already proven the core product-native execution path needed for a practical one-window orchestrator:

- GitHub remains the durable Source of Record;
- a fresh cloud executor can recover project context from current `main` and `MEMORY.md` without CEO history restatement;
- GitHub Issue `@codex` can launch a bounded Codex Cloud task;
- Codex Cloud can produce a bounded repository change;
- the Codex result page can publish that result to a GitHub PR;
- exact PR HEAD, diff, scope, mergeability, and review evidence can be verified from GitHub before any consequential gate;
- independent review and separate CEO Ready / merge gates are already used in practice.

The remaining platform limitation is narrower than the original T-006 blocker: initial result publication currently requires one CEO `Create PR` click, and the proven result-page publication path did not preserve Draft state by default. These limitations must be explicit, not hidden behind custom transport.

T-006 remains `BLOCKED` until this Specification is independently reviewed, CEO-approved, and later receives separate Execution Authorization.

## 2. Goal

Define the smallest useful Genesis Orchestrator v0.1 that lets the CEO give one bounded command in the Genesis conversation and have the system coordinate the full engineering workflow through GitHub and product-native Codex Cloud, while preserving GitHub Source-of-Truth and CEO control over consequential actions.

The orchestrator is a controlled workflow/protocol role. It is not a new standalone runtime, service, console, or autonomous source of truth.

## 3. Baseline architecture

```text
CEO / Genesis conversation
        ↓
Genesis Orchestrator
        ↓
read current main + MEMORY.md + required canonical artifacts
        ↓
create bounded GitHub Issue
        ↓
product-native @codex launch
        ↓
Codex Cloud execution
        ↓
GitHub PR publication
        ↓
GitHub exact-artifact verification
        ↓
independent review of exact HEAD / diff
        ↓
CEO consequential gate(s)
        ↓
merge only after separate authorization
        ↓
post-merge verification + durable Memory/Bridge maintenance when required
```

## 4. Functional requirements

### 4.1 Context recovery

1. The orchestrator MUST obtain exact current `main` before formulating implementation work.
2. It MUST read `MEMORY.md` from that state and follow its recovery protocol.
3. It MUST read only the canonical artifacts necessary for the current task.
4. Chat history MAY help interpret the CEO request but MUST NOT override GitHub evidence.
5. If `MEMORY.md` conflicts with a higher-priority canonical artifact, the canonical artifact wins and the mismatch MUST be recorded or corrected through normal reviewable GitHub workflow.

### 4.2 Task formation

6. The orchestrator MUST convert an accepted CEO goal into one bounded GitHub Issue with explicit goal, scope, non-goals, acceptance criteria, prohibited actions, and `Memory impact: YES/NO`.
7. Significant implementation MUST reference an Approved Specification and applicable Decision Records.
8. If no Approved Specification exists, the orchestrator MUST stop implementation and prepare a Draft Specification instead.

### 4.3 Executor routing

9. Product-native GitHub Issue `@codex` → Codex Cloud is the preferred bounded coding-executor path for v0.1 when the repository environment supports it.
10. ChatGPT Work remains a proven fallback executor for bounded GitHub work, but v0.1 MUST NOT require manual CEO copy/paste into a separate executor window as the default route.
11. Copilot direct assignment MUST remain disabled/blocked unless new supported capability evidence supersedes the current failed path.
12. Local Codex reinstall MUST NOT be required for v0.1.
13. Dify, Broker, custom transport, GitHub Actions, PAT injection, or new runtime infrastructure MUST NOT be introduced merely to remove the remaining publication click.

### 4.4 Publication and artifact verification

14. The orchestrator MUST treat task-side Codex completion and GitHub PR publication as separate observable states.
15. Until a supported automatic initial-PR route is proven, one CEO `Create PR` click on the existing Codex result page MAY be accepted as a documented platform limitation for v0.1.
16. After publication, the orchestrator MUST verify from GitHub at minimum: PR number, open/draft state, base SHA, exact HEAD SHA, changed files, diff, commit count, and mergeability.
17. If publication creates a non-Draft PR where the bounded task required Draft, the orchestrator MAY restore Draft state without content changes when the connected GitHub action supports it; this correction MUST be recorded.
18. The orchestrator MUST NOT claim zero-click One-Window completion while a manual publication action remains required.

### 4.5 Review

19. Independent review MUST inspect the actual GitHub diff and exact HEAD, not executor summaries alone.
20. The author/executor of an implementation MUST NOT be the sole independent reviewer of that implementation.
21. Review verdicts MUST be durably recorded in GitHub when they affect Ready/merge decisions.
22. Any finding that changes the reviewed HEAD requires re-verification and, when material, re-review.

### 4.6 CEO gates

23. Specification Approval remains a separate CEO decision.
24. Execution Authorization remains separate from Specification Approval.
25. Ready and merge remain separate consequential gates unless a later accepted governance artifact explicitly changes that rule.
26. Deployment, secrets, LIVE activation, production writes, Dify, Broker, Cloudflare, and other runtime boundaries remain separately gated where applicable.
27. No successful step implicitly authorizes the next consequential step.

### 4.7 Durable state maintenance

28. GitHub remains the only durable Source of Record.
29. After an accepted merge, the orchestrator MUST perform post-merge verification.
30. If accepted work materially changes `CURRENT_STATE`, blockers, `CURRENT_BASELINE`, `NEXT_ACTION`, active decisions, external dependencies, or trial status, the orchestrator MUST prepare the required `MEMORY.md` update under the Memory maintenance contract.
31. `bridge/QUEUE.md` and `bridge/HANDOFF.md` remain authoritative for task status and handoff where applicable.

## 5. Non-functional requirements

- Fail closed on unknown executor/publication state.
- Prefer product-native capabilities over custom infrastructure.
- Minimize CEO manual work to consequential decisions and unavoidable platform limitations.
- Do not expose or store secrets in GitHub artifacts or chat-visible logs.
- Preserve exact-SHA verification for review and merge.
- Keep each implementation task bounded enough that scope can be verified from a small PR.
- Do not auto-merge.

## 6. Scope for first implementation after Approval + EA

The first implementation exercise for S-0007 MUST be **Genesis One-Window Trial #4** on one real, small, low-risk repository task.

Trial #4 is not authorized by this Approval. A later separate EA MUST define the exact Issue and allowed files.

Trial #4 success criteria:

1. CEO gives one bounded product/project command in the Genesis conversation.
2. Orchestrator recovers current project context from GitHub without requesting project history.
3. Orchestrator creates the bounded implementation Issue.
4. Product-native `@codex` launches Codex Cloud without CEO manually transferring the task text.
5. Codex produces the requested bounded change.
6. Result is published to GitHub PR using the supported product-native path available at execution time.
7. Orchestrator verifies exact GitHub artifacts and restores Draft state if necessary and supported.
8. Independent reviewer evaluates exact HEAD/diff.
9. CEO is asked only at the applicable consequential gate(s), plus the known result-page `Create PR` click if the platform still requires it.
10. No Dify/Broker/custom transport is used to make the trial pass.
11. Merge is not automatic.

A PASS for v0.1 does **not** require pretending the publication click is solved. The trial report MUST classify that residual action explicitly.

## 7. Explicit non-goals

S-0007 Revision 1 does not authorize or require:

- a custom Genesis web console;
- LangGraph or another standalone orchestration runtime;
- Dify workflow recovery;
- Broker expansion or Broker authentication changes;
- Cloudflare deployment;
- new secrets/PATs/API keys;
- GitHub Actions automation;
- merge endpoints or auto-merge;
- autonomous strategic decisions;
- multiple parallel coding agents;
- long-term vector memory;
- changing Constitution or existing Decision Records;
- changing T-006 from `BLOCKED` before governance gates are satisfied.

## 8. Dependencies

Required:

- GitHub connector access to the repository;
- current Genesis Long-Term Project Memory V1;
- existing Codex Cloud repository environment or equivalent supported environment;
- product-native GitHub Issue `@codex` launch capability;
- an available independent reviewer for implementation diffs.

Known external limitation:

- automatic task-side creation of the first GitHub PR is not proven;
- result-page `Create PR` is proven but requires one CEO click under current evidence;
- Draft preservation is not guaranteed by the proven result-page publication path.

## 9. Verification

Before this Specification can be Approved:

- independent architecture/spec review of the exact Draft PR HEAD;
- review must explicitly check compatibility with Constitution, Development Workflow, DR-0004, DR-0005, DR-0010, current `MEMORY.md`, T-006, and Roadmap Phase 2;
- review must confirm the document does not silently reactivate Dify/Broker or grant runtime authority;
- CEO Approval must be explicit and separate from any later EA.

Before any implementation merge under S-0007:

- exact-head independent implementation review;
- separate CEO merge authorization;
- post-merge verification.

## 10. Output artifacts

Revision 1 Approval consists only of:

- `specifications/S-0007-Genesis-Orchestrator-v0.1.md`;
- corresponding `specifications/INDEX.md` entry.

No implementation artifact is authorized by this Approval.

## 11. Decision Record need

No new Decision Record is required merely to approve Revision 1 because independent review concluded that S-0007 composes already accepted project principles and proven product-native evidence rather than changing a durable architectural principle.
