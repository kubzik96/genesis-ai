# Genesis Night Shift Revision 2 — Qodo Council Review Surface

Status: REVIEW ONLY — NOT AUTHORIZATION
Baseline: `c20402afe71b23dfc264927fc2b7316d8ae2130d`

## Proposed CEO Gate
Genesis may run a first Draft-only Night Shift Revision 2 as a sequential canary.

### Goal
Prove: recover → autonomously select eligible task → bounded Codex → independently verify Result Package → materialize verified bytes → Draft PR → exact-HEAD Qodo review → synthesize → durable GitHub evidence → reconcile → STOP or conditionally select one second eligible workstream. Success is the proven cycle, not PR count.

### Recovery/controller
Verify exact main baseline, current MEMORY/recovery protocol and needed canon, open Night-Shift artifacts, STOP/UNKNOWN and unresolved mutations. If IN_PROGRESS state has no clear owner, or another controller may be active, STOP. Baseline/canonical/authority ambiguity fails closed.

### Path allowlist
Only `docs/**`, `bridge/**`, `MEMORY.md`, and existing test-only paths for bounded verification that does not change production runtime. Outside: `services/**`, `specifications/**`, `decisions/**`, governance, production/runtime, Broker/reviewer runtime, infrastructure/configuration.

### Publication shape
Only already-proven controlled Result Package / Genesis-side verification/materialization class compatible with #103/#104 and later bounded use. Do not generalize to arbitrary/general publication. Exceeding proven shape → STOP/separate CEO gate.

### Task selection
Candidates only from canonical GitHub evidence: MEMORY, QUEUE, open Issues, known blockers, external dependencies, failed paths, current One-Window gaps. Eligible only if useful, low-risk, reversible, repository-local, inside allowlist, objective acceptance criteria + deterministic verification, no new architecture/product/governance decision, no secrets/permissions/network/infrastructure/production/LIVE, no STOP/UNKNOWN/quarantine intersection, proven publication shape, no conflict with existing work. Rank blocker removal, recovery/verification value, smallest diff, strongest evidence, lowest rollback risk. Persist selection rationale and meaningful exclusions before Codex. No safe useful task → STOP EARLY.

### Sequential canary
WS1: ≤1 Issue, branch, Codex run, Result Package, Draft PR, Qodo review; retries=0; independent base/path/hash/bytes/diff verification and deterministic checks; synthesis ACCEPT/REJECT/CEO_ESCALATION. No remediation. Material Qodo finding → verify, persist, STOP. Ready/merge forbidden.

WS2 only after WS1 fully verified/read-back/reconciled, exact HEAD + persisted Qodo review, no unresolved material finding/scope violation/UNKNOWN. Same limits. After WS2 mandatory STOP.

Total ceiling: workstreams≤2, Codex≤2, Issues≤2, branches≤2, Draft PRs≤2, Qodo≤2, retries=0. Ceiling ≠ target.

### Reviewers
Qodo advisory only; exact-HEAD bound; any changed HEAD invalidates old evidence; no remediation/re-review loop; no scope/Ready/merge authority.

Production Grok/Broker/LIVE=0; #108 outside scope. ≤2 Grok advisory consultations only through already-safe non-production channel with no secrets/Cloudflare/Broker mutation/LIVE/production API/permission expansion. Each used advisory gets durable GitHub note. Consequential security/architecture needing unavailable assurance → CEO_ESCALATION.

### Recovery evidence / ambiguity
GitHub per workstream: run ID, baseline, authority, rationale, Issue, branch, Codex contract/attempt, Result Package hash/verification, paths, checks, Draft PR/exact HEAD, Qodo HEAD/verdict/findings, Grok note if used, Genesis synthesis, budget, STOP classification, next human action. MEMORY is not transaction log.

Ambiguous mutation → `UNKNOWN_RECONCILIATION_REQUIRED`; read-only reconcile first; no auto-retry.

### STOP/forbidden
Global STOP on main drift, canonical/authority ambiguity, unclear/second controller, persistence/reconciliation failure, credential-like material, secret/permission/network or LIVE/production/deploy/Ready/merge need, consequential security/architecture without sufficient independent review, idempotency/state corruption, unreconciled ambiguity, allowlist violation, publication-shape expansion, ceiling exhaustion.

Forbidden: Ready, merge/auto-merge, remediation loop, secrets/PAT, permission/network expansion, GitHub Actions/new privileged automation, `services/**`, specifications/decisions/governance changes, Broker/Dify/Cloudflare mutation, deploy/promotion, LIVE, production model/API/traffic/Grok/xAI, #108, #96 retry, DR-0008 quarantine removal, destructive actions, paid commitments.

### Time/report
Hard stop 10:00 Asia/Almaty; no new workstream after 09:30. Morning report in Russian/plain language: what was done/why; what improved/newly proved; what failed; remaining risks as Problem→severity→action; current One-Window autonomous/manual boundaries; evidence-driven roadmap Step→why→proof target + next CEO gate; compact technical checkpoint including START/END main, Issues, Codex, Draft PR HEADs, Qodo verdict, Grok advisory count, failures/UNKNOWN, budgets and SECRETS/LIVE/DEPLOY/READY/MERGE=NONE.

## Qodo review request
Review this exact proposed gate as architecture/governance/safety, not implementation or authorization. Evaluate ≤2 sequential canary, allowlist, publication boundary, Codex authority/retries, exact-HEAD Qodo role, Grok production=0, controller/reconciliation, task selection vs standing authority, fail-closed stops, and morning evidence.

Return `APPROVE`, `APPROVE_WITH_CHANGES`, or `BLOCK`; identify exact required changes and why. Explicitly answer whether you would authorize this exact gate as independent safety/reliability reviewer.

This artifact authorizes no Night Shift start, implementation, remediation, Ready, merge, #108, secrets, LIVE, Broker, Cloudflare, Dify or production calls.