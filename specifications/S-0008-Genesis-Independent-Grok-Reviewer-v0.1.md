# S-0008 — Genesis Independent Grok Reviewer v0.1

## Metadata

| Field | Value |
|---|---|
| ID | S-0008 |
| Title | Genesis Independent Grok Reviewer v0.1 |
| Status | **Draft** |
| Revision | 1 |
| Date | 2026-09-03 |
| Related Issue | #79 |
| Related Specification | S-0005 Revision 2 |
| Related Decisions | DR-0007, DR-0008, DR-0009 |
| Execution Authorization | **NOT_GRANTED** |

## 1. Purpose

Define the smallest safe independent-review path that can replace temporary Qodo review in the Genesis PR workflow. Grok/xAI is an independent read/advisory reviewer, not an executor, GitHub writer, approval authority, or Source of Truth.

Target flow:

```text
CEO request → Genesis orchestrator → bounded executor → Draft PR
→ independent Grok/xAI review bound to exact PR HEAD
→ Genesis evaluates findings → CEO consequential gate
```

Qodo may be used as temporary validation scaffolding while its trial is available, but Genesis MUST NOT depend on Qodo for the permanent reviewer path.

## 2. Canonical boundaries

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. The orchestrator owns routing, collection of bounded review context, interpretation of reviewer output, and presentation of subsequent CEO gates.

S-0008 does not revise or activate S-0005. The S-0005 Grok writer/executor contract MUST NOT be reused as the reviewer contract as-is. Reviewer authority is strictly smaller and contains no GitHub write capability.

Actor independence is mandatory. Grok/xAI under S-0008 MUST NOT be the sole independent reviewer of an implementation or artifact produced by Grok/xAI, including work produced under S-0005. Such work requires an independent non-Grok reviewer as required by repository governance and DR-0007.

DR-0008 quarantine remains authoritative. This specification does not lift quarantine, authorize authenticated Broker calls, rotate credentials, unfreeze Dify, deploy anything, or authorize LIVE xAI calls.

## 3. Review input and exact-HEAD contract

A review request MUST bind to:

- repository: exactly `kubzik96/genesis-ai`;
- PR number;
- exact expected 40-character PR HEAD SHA;
- bounded unified diff and changed-file metadata for that exact HEAD;
- only canonical GitHub context strictly necessary to judge the requested change;
- explicit review criteria and known task/specification acceptance criteria when applicable.

The orchestrator MUST fetch and verify the actual PR HEAD before preparing the request. The reviewer response MUST echo the exact reviewed SHA as `REVIEWED_HEAD_SHA`. Immediately before Genesis accepts or persists the review result as gate evidence, the orchestrator MUST fetch the current PR HEAD again and compare it with both the expected SHA and `REVIEWED_HEAD_SHA`. Any mismatch makes the review stale; the result MUST normalize to `BLOCKED` / `READY_GATE_SAFE: NO` and MUST NOT influence a Ready, merge, approval, or execution gate. A changed HEAD requires a fresh review of the new exact HEAD under the applicable authorization.

Secrets, PATs, service tokens, authorization headers, private execution payloads, raw sensitive logs, and unrelated repository context MUST NOT be included.

## 4. Structured output contract

The reviewer response MUST be machine-checkable and contain at minimum:

```text
VERDICT: APPROVE | APPROVE_WITH_FINDINGS | REQUEST_CHANGES | BLOCKED
REVIEWED_HEAD_SHA: <exact 40-character SHA>
HEAD_CONFIRMED: YES | NO
SCOPE: CLEAN | NOT_CLEAN
FINDINGS:
- <severity>: <concise finding with evidence>
READY_GATE_SAFE: YES | NO
STOP
```

Findings SHOULD cite file/path and relevant evidence. Unknown, missing, malformed, or semantically contradictory fields are fail-closed.

Cross-field invariants are normative:

- `HEAD_CONFIRMED: NO` or `SCOPE: NOT_CLEAN` MUST produce `VERDICT: BLOCKED` and `READY_GATE_SAFE: NO`;
- `VERDICT: REQUEST_CHANGES` or `VERDICT: BLOCKED` MUST have `READY_GATE_SAFE: NO`;
- `READY_GATE_SAFE: YES` is permitted only with `HEAD_CONFIRMED: YES`, `SCOPE: CLEAN`, and `VERDICT: APPROVE` or `APPROVE_WITH_FINDINGS`;
- `REVIEWED_HEAD_SHA` MUST equal the expected HEAD and the acceptance-time current HEAD;
- any combination violating these invariants MUST normalize to `VERDICT: BLOCKED` and `READY_GATE_SAFE: NO`.

`APPROVE` or `READY_GATE_SAFE: YES` is advisory evidence only. It does not mark a PR Ready, merge it, grant Specification Approval, grant Execution Authorization, authorize deployment/secrets/LIVE, or chain any later CEO gate.

## 5. Fail-closed requirements

The review MUST stop without an approval recommendation when any of the following applies:

1. request-time, reviewed, or acceptance-time PR HEAD values do not all match;
2. repository or PR identity cannot be verified;
3. required diff/context is unavailable, truncated beyond the bounded review contract, or exceeds configured limits;
4. output violates the structured response contract or its cross-field invariants;
5. requested review would require GitHub credentials or write authority to be exposed to Grok/xAI;
6. authentication, quarantine, secret-handling, or LIVE state is uncertain;
7. the request attempts to expand reviewer authority into execution, GitHub writes, merge, deploy, secret operations, or another control plane;
8. Grok/xAI would be the sole independent reviewer of its own implementation or artifact.

A fail-closed result MUST normalize to `VERDICT: BLOCKED` and `READY_GATE_SAFE: NO` and MUST NOT be interpreted as approval.

## 6. Authority and security boundary

Grok/xAI reviewer MUST NOT receive GitHub PAT, `BROKER_SERVICE_TOKEN`, repository write credentials, or other credentials enabling repository mutation.

The reviewer MUST NOT:

- create or update Issues, comments, branches, commits, PRs, or refs;
- mark Ready, approve on behalf of the CEO, merge, or auto-merge;
- execute S-0005 writer operations;
- modify secrets or configuration;
- deploy or activate LIVE;
- invoke Dify or Cloudflare operations;
- become an independent Source of Truth;
- silently retry a failed or ambiguous external operation.

If a future implementation uses Broker as transport, Broker remains the trusted boundary and DR-0008 prerequisites MUST be satisfied first under separate CEO authorization. S-0008 itself grants no authenticated Broker use.

## 7. Future implementation scope

After Specification Approval, an approved Decision Record for the new reviewer component, and a separate Execution Authorization, the minimum implementation SHOULD be a thin reviewer-only contract that:

1. receives a repository/PR/exact-HEAD review request from Genesis;
2. verifies request-time HEAD and obtains or is supplied only bounded read context;
3. makes one bounded xAI review request under a default-off/LIVE gate;
4. validates the structured response and cross-field invariants;
5. re-fetches and verifies acceptance-time current HEAD before accepting the result;
6. returns the advisory result to Genesis;
7. performs zero GitHub writes and STOPs.

Implementation SHOULD reuse existing safe read, validation, adapter, and budget-ledger primitives where compatible, but MUST NOT broaden the S-0005 writer endpoint or inherit its write authority merely for convenience.

### 7.1 Allowed files

A future implementation EA MUST name the exact file allowlist. At specification level, implementation is limited to the smallest reviewer-only additions/changes under the existing `services/genesis-broker` code and test tree that are strictly necessary for:

- reviewer request/response schema and validation;
- exact-HEAD read verification;
- bounded xAI adapter invocation using existing safe primitives where compatible;
- reviewer-only routing/orchestration glue;
- local/unit tests and fixtures for this contract.

Existing S-0005 writer behavior may be read or safely reused through shared non-write primitives, but its writer endpoint/authority MUST NOT be expanded by S-0008.

### 7.2 Prohibited files and changes

A future S-0008 implementation MUST NOT modify, unless a later separately approved specification explicitly requires it:

- Dify workflows/plugins/configuration;
- Cloudflare deployment configuration or production bindings;
- GitHub Actions/workflows;
- secrets, credentials, PAT configuration, or secret-bearing files;
- S-0005 writer contract/endpoint semantics;
- unrelated product/runtime code;
- governance or Decision Records merely to make implementation convenient.

The implementation EA MUST narrow this boundary further to exact paths before coding begins.

### 7.3 Dependencies

Permitted dependencies are the existing Genesis Broker read/validation infrastructure, existing xAI adapter and budget-control primitives where they can be reused without write-authority inheritance, canonical GitHub read context supplied/verified by Genesis or an approved read boundary, and the existing test toolchain. New runtime frameworks, transports, GitHub write credentials, or third-party control planes are not required by this specification and require separate architectural approval if proposed.

### 7.4 Assumptions

- GitHub remains the canonical Source of Record and exposes an exact PR HEAD to the trusted Genesis side.
- The xAI model can return the bounded structured response, but its output is untrusted until validated.
- No LIVE reviewer call is necessary to implement or locally verify the contract.
- DR-0008 quarantine remains active unless separately and explicitly resolved.
- Qodo availability is temporary and is not an implementation dependency.

### 7.5 Verification methods

Before implementation can be considered review-ready, local/mock verification MUST demonstrate at minimum:

- valid exact-HEAD approval path;
- request-time HEAD mismatch fails closed;
- HEAD change during review / acceptance-time mismatch fails closed;
- missing or malformed `REVIEWED_HEAD_SHA` fails closed;
- contradictory output combinations fail closed;
- oversized/truncated/missing review context fails closed;
- secret/credential fields are rejected or excluded from reviewer payloads;
- Grok self-review of Grok-produced work is rejected as independent-review evidence;
- zero GitHub write operation is available through the reviewer contract;
- xAI/API errors and malformed model output fail closed;
- existing relevant S-0005/Broker tests remain passing where shared primitives are touched.

The first LIVE xAI smoke, if ever required, is NOT part of ordinary implementation verification and requires its own explicit CEO gate after all applicable DR-0008/security prerequisites are satisfied.

### 7.6 Expected output artifacts

A future implementation PR is expected to contain only the bounded reviewer implementation and tests authorized by its EA, plus strictly necessary documentation synchronization. It MUST provide evidence of the exact implementation HEAD, changed-file scope, local/mock test results, independent exact-HEAD implementation review, and any remaining blocked LIVE/security gates. It MUST remain Draft until the applicable CEO Ready gate.

### 7.7 Decision Record necessity

A new Decision Record is **required before implementation** because S-0008 introduces a new reviewer system component/capability: a distinct reviewer contract, reviewer routing/orchestration, and xAI review invocation within the Genesis/Broker control model. The Decision Record MUST define the component boundary, trust/credential boundary, relationship to S-0005/DR-0007, preservation of DR-0008 quarantine/default-off behavior, and confirm that Grok/xAI receives no GitHub write authority.

Specification Approval does not approve that future Decision Record, and a Decision Record does not grant Execution Authorization. The future DR requires its own controlled review/acceptance under repository governance before S-0008 implementation may begin. If the proposed implementation later requires a new control plane, new credential trust boundary, Dify unfreeze, Broker authority expansion, or another material architectural departure beyond the approved DR, implementation MUST stop and the architecture decision must be revised or supplemented before proceeding.

## 8. Acceptance criteria

S-0008 v0.1 is implementation-ready only when an independently reviewed revision demonstrates that:

- reviewer and writer/executor contracts are separate;
- actor independence is explicit: Grok/xAI cannot be the sole independent reviewer of Grok/xAI-produced work;
- request-time, reviewed, and acceptance-time exact HEAD are bound and stale reviews are invalidated;
- input context is bounded and secret-free;
- output is structured, cross-field consistent, and fail-closed;
- Grok/xAI has no GitHub write authority or GitHub credentials;
- future implementation file boundaries, dependencies, assumptions, verification methods, output artifacts, and Decision Record necessity are explicit;
- an approved Decision Record for the new reviewer component is required before implementation EA can be exercised;
- GitHub remains the durable Source of Record;
- Qodo is optional temporary scaffolding, not a dependency;
- DR-0008 quarantine/default-off restrictions remain intact;
- Specification Approval, Decision Record approval, implementation EA, first LIVE xAI call, Ready, merge, secrets, deploy and quarantine removal remain separate gates.

## 9. Explicit non-goals

This revision does not authorize or require:

- implementation code or tests;
- any xAI/Grok API call;
- secrets inspection, creation, rotation, or transfer;
- authenticated Broker calls;
- Dify or Cloudflare operations;
- deployment or LIVE activation;
- GitHub Actions, PAT additions, custom transport, or a new control plane;
- multi-agent mesh, voting, debate, or always-on advisory swarm;
- modification of S-0005 or existing runtime code in this specification step;
- removal of Qodo before a replacement is proven;
- Ready or merge of an implementation PR.

## 10. Gates and next step

Current state: **Draft / Execution Authorization NOT_GRANTED**.

Required sequence:

1. independent review of this exact specification Draft PR;
2. separate CEO Specification Approval;
3. promotion of the approved specification through the repository's controlled documentation workflow;
4. prepare and independently review the required Decision Record for the new reviewer component;
5. separate CEO acceptance/approval of that Decision Record under repository governance;
6. separate CEO Execution Authorization for bounded implementation;
7. implementation and independent exact-HEAD review;
8. separate CEO gates for any secret operation, authenticated Broker use/quarantine removal, deployment, or first LIVE xAI call as applicable.

No successful step implicitly authorizes the next one.
