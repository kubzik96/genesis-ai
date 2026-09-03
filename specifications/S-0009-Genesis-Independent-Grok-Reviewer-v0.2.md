# S-0009 — Genesis Independent Grok Reviewer v0.2

## Metadata

| Field | Value |
|---|---|
| ID | S-0009 |
| Title | Genesis Independent Grok Reviewer v0.2 |
| Status | **Draft** |
| Revision | 1 |
| Author | ChatGPT — COO, по поручению CEO Genesis AI |
| Creation date | 2026-09-03 |
| Approval date | NOT_APPROVED |
| Approved by | NOT_APPROVED |
| Related task | None yet; architecture tracker is Issue #79 |
| Related Issue | #79 |
| Supersedes | S-0008 Revision 1 |
| Related Specification | S-0005 Revision 2 |
| Related Decisions | DR-0007, DR-0008, DR-0009, DR-0011 (Accepted) |
| Future executor (after Authorization) | bounded Codex Cloud implementation executor unless a later EA names another executor |
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

GitHub `kubzik96/genesis-ai` remains the durable Source of Record. The orchestrator owns routing, collection of bounded review context, interpretation of reviewer output, durable persistence of consequential review evidence, and presentation of subsequent CEO gates.

S-0009 supersedes S-0008 Revision 1 because post-approval corrections changed acceptance criteria and therefore constitute a Major specification change. S-0009 does not revise or activate S-0005. The S-0005 Grok writer/executor contract MUST NOT be reused as the reviewer contract as-is. Reviewer authority is strictly smaller and contains no GitHub write capability.

Actor independence is mandatory. Grok/xAI under S-0009 MUST NOT be the sole independent reviewer of an implementation or artifact produced by Grok/xAI, including work produced under S-0005. Such work requires an independent non-Grok reviewer as required by repository governance and DR-0007.

DR-0011 is the accepted architecture Decision Record for this reviewer component. Its acceptance does not approve S-0009, grant Execution Authorization, authorize authenticated Broker use, secrets operations, deployment, or LIVE xAI.

DR-0008 quarantine remains authoritative. This specification does not lift quarantine, authorize authenticated Broker calls, rotate credentials, unfreeze Dify, deploy anything, or authorize LIVE xAI calls.

## 3. Review input and exact-HEAD contract

A review request MUST bind to:

- repository: exactly `kubzik96/genesis-ai`;
- PR number;
- exact expected 40-character PR HEAD SHA;
- bounded unified diff and changed-file metadata for that exact HEAD;
- only canonical GitHub context strictly necessary to judge the requested change;
- explicit review criteria and known task/specification acceptance criteria when applicable.

The orchestrator MUST fetch and verify the actual PR HEAD before preparing the request. The reviewer response MUST echo the exact reviewed SHA as `REVIEWED_HEAD_SHA`. Immediately before Genesis persists a review result as gate evidence, the orchestrator MUST fetch the current PR HEAD again and compare it with both the expected SHA and `REVIEWED_HEAD_SHA`. Any mismatch makes the review stale; the result MUST normalize to `BLOCKED` / `READY_GATE_SAFE: NO` and MUST NOT influence a Ready, merge, approval, or execution gate. A changed HEAD requires a fresh review of the new exact HEAD under the applicable authorization.

Any reviewer verdict that may influence Ready, merge, Specification Approval, Decision Record acceptance, Execution Authorization, or another consequential gate MUST be durably recorded in GitHub by the trusted Genesis orchestrator/control boundary together with the exact `REVIEWED_HEAD_SHA` **before** Genesis uses that verdict as gate evidence. Persistence is mandatory, not an alternative to acceptance. Grok/xAI itself receives no GitHub write authority.

Secrets, PATs, service tokens, authorization headers, private execution payloads, raw sensitive logs, and unrelated repository context MUST NOT be included.

## 4. Structured output contract

The reviewer response MUST be machine-checkable and contain at minimum:

```text
VERDICT: APPROVE | APPROVE_WITH_FINDINGS | REQUEST_CHANGES | BLOCKED
REVIEWED_HEAD_SHA: <exact 40-character SHA>
HEAD_CONFIRMED: YES | NO
SCOPE: CLEAN | NOT_CLEAN
FINDINGS:
- SEVERITY: INFO | LOW | MEDIUM | HIGH | CRITICAL
  DISPOSITION: NON_BLOCKING | BLOCKING
  EVIDENCE: <concise finding with file/path or other bounded evidence>
READY_GATE_SAFE: YES | NO
STOP
```

Every finding MUST use exactly one allowed `SEVERITY` and one allowed `DISPOSITION`. `DISPOSITION` is normative for gate safety: `BLOCKING` means the finding must be resolved before the reviewed artifact may be used as positive evidence for a consequential gate. `NON_BLOCKING` means the finding may remain advisory. `HIGH` and `CRITICAL` findings MUST always use `DISPOSITION: BLOCKING`; `INFO`, `LOW`, and `MEDIUM` MAY be `NON_BLOCKING` or `BLOCKING` according to whether the finding invalidates an applicable requirement or gate condition. Unknown severity/disposition values, missing fields, malformed findings, or semantically contradictory fields are fail-closed.

Findings SHOULD cite file/path and relevant evidence.

Cross-field invariants are normative:

- `HEAD_CONFIRMED: NO` or `SCOPE: NOT_CLEAN` MUST produce `VERDICT: BLOCKED` and `READY_GATE_SAFE: NO`;
- any `DISPOSITION: BLOCKING` finding MUST produce `VERDICT: REQUEST_CHANGES` or `BLOCKED` and `READY_GATE_SAFE: NO`;
- any `SEVERITY: HIGH` or `CRITICAL` finding MUST be `DISPOSITION: BLOCKING` and therefore MUST have `READY_GATE_SAFE: NO`;
- `VERDICT: REQUEST_CHANGES` or `VERDICT: BLOCKED` MUST have `READY_GATE_SAFE: NO`;
- `VERDICT: APPROVE` MUST contain no findings;
- `VERDICT: APPROVE_WITH_FINDINGS` MAY contain only `DISPOSITION: NON_BLOCKING` findings;
- `READY_GATE_SAFE: YES` is permitted only with `HEAD_CONFIRMED: YES`, `SCOPE: CLEAN`, no blocking findings, and `VERDICT: APPROVE` or `APPROVE_WITH_FINDINGS`;
- `REVIEWED_HEAD_SHA` MUST equal the expected HEAD and the acceptance-time current HEAD;
- any combination violating these invariants MUST normalize to `VERDICT: BLOCKED` and `READY_GATE_SAFE: NO`.

`APPROVE` or `READY_GATE_SAFE: YES` is advisory evidence only. It does not mark a PR Ready, merge it, grant Specification Approval, grant Execution Authorization, authorize deployment/secrets/LIVE, or chain any later CEO gate. A consequential gate MUST NOT rely on the verdict until the trusted Genesis side has durably recorded it in GitHub with the exact reviewed HEAD.

## 5. Fail-closed requirements

The review MUST stop without an approval recommendation when any of the following applies:

1. request-time, reviewed, or acceptance-time PR HEAD values do not all match;
2. repository or PR identity cannot be verified;
3. required diff/context is unavailable, truncated beyond the bounded review contract, or exceeds configured limits;
4. output violates the structured response contract or its cross-field invariants, including missing/unknown severity or disposition, a `HIGH`/`CRITICAL` finding marked non-blocking, or any blocking finding paired with a gate-safe verdict;
5. requested review would require GitHub credentials or write authority to be exposed to Grok/xAI;
6. authentication, quarantine, secret-handling, or LIVE state is uncertain;
7. the request attempts to expand reviewer authority into execution, GitHub writes, merge, deploy, secret operations, or another control plane;
8. Grok/xAI would be the sole independent reviewer of its own implementation or artifact;
9. a verdict intended for consequential-gate use cannot be durably persisted in GitHub by the trusted Genesis side with the exact reviewed HEAD before that use.

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

If a future implementation uses Broker as transport, Broker remains the trusted boundary and DR-0008 prerequisites MUST be satisfied first under separate CEO authorization. S-0009 itself grants no authenticated Broker use.

## 7. Future implementation scope

After Specification Approval and a separate Execution Authorization, the minimum implementation SHOULD be a thin reviewer-only contract that:

1. receives a repository/PR/exact-HEAD review request from Genesis;
2. verifies request-time HEAD and obtains or is supplied only bounded read context;
3. makes one bounded xAI review request under a default-off/LIVE gate;
4. validates the structured response, finding severity/disposition, and cross-field invariants;
5. re-fetches and verifies acceptance-time current HEAD;
6. for consequential-gate use, requires the trusted Genesis side to durably persist the validated verdict in GitHub with the exact reviewed HEAD before the verdict can be accepted as gate evidence;
7. returns the advisory result to Genesis;
8. performs zero GitHub writes from the Grok/xAI reviewer and STOPs.

Implementation SHOULD reuse existing safe read, validation, adapter, and budget-ledger primitives where compatible, but MUST NOT broaden the S-0005 writer endpoint or inherit its write authority merely for convenience.

### 7.1 Allowed files

A future implementation EA MUST name the exact file allowlist. At specification level, implementation is limited to the smallest reviewer-only additions/changes under the existing `services/genesis-broker` code and test tree that are strictly necessary for reviewer request/response schema and validation, exact-HEAD read verification, bounded xAI adapter invocation using existing safe primitives where compatible, reviewer-only routing/orchestration glue, and local/unit tests and fixtures for this contract.

Existing S-0005 writer behavior may be read or safely reused through shared non-write primitives, but its writer endpoint/authority MUST NOT be expanded by S-0009.

### 7.2 Prohibited files and changes

A future S-0009 implementation MUST NOT modify, unless a later separately approved specification explicitly requires it: Dify workflows/plugins/configuration; Cloudflare deployment configuration or production bindings; GitHub Actions/workflows; secrets, credentials, PAT configuration, or secret-bearing files; S-0005 writer contract/endpoint semantics; unrelated product/runtime code; governance or Decision Records merely to make implementation convenient.

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
- missing/unknown finding severity or disposition fails closed;
- every `HIGH` or `CRITICAL` finding is forced to `DISPOSITION: BLOCKING` and `READY_GATE_SAFE: NO`;
- any blocking finding paired with `APPROVE`, `APPROVE_WITH_FINDINGS`, or `READY_GATE_SAFE: YES` fails closed;
- `APPROVE_WITH_FINDINGS` is accepted only when every finding is explicitly non-blocking and all other invariants hold;
- contradictory output combinations fail closed;
- oversized/truncated/missing review context fails closed;
- secret/credential fields are rejected or excluded from reviewer payloads;
- Grok self-review of Grok-produced work is rejected as independent-review evidence;
- zero GitHub write operation is available through the reviewer contract;
- consequential-gate evidence cannot be used until the trusted Genesis side has durably persisted the verdict in GitHub with the exact reviewed HEAD;
- xAI/API errors and malformed model output fail closed;
- existing relevant S-0005/Broker tests remain passing where shared primitives are touched.

The first LIVE xAI smoke, if ever required, is NOT part of ordinary implementation verification and requires its own explicit CEO gate after all applicable DR-0008/security prerequisites are satisfied.

### 7.6 Expected output artifacts

A future implementation PR is expected to contain only the bounded reviewer implementation and tests authorized by its EA, plus strictly necessary documentation synchronization. It MUST provide evidence of the exact implementation HEAD, changed-file scope, local/mock test results, independent exact-HEAD implementation review, durable GitHub recording of any consequential-gate reviewer evidence, and any remaining blocked LIVE/security gates. It MUST remain Draft until the applicable CEO Ready gate.

### 7.7 Decision Record necessity

DR-0011 is **required and CEO-accepted** because this reviewer capability introduces a distinct reviewer contract, reviewer routing/orchestration, and xAI review invocation within the Genesis/Broker control model. DR-0011 defines the component boundary, trust/credential boundary, relationship to S-0005/DR-0007, preservation of DR-0008 quarantine/default-off behavior, and confirms that Grok/xAI receives no GitHub write authority.

Approval of S-0009 does not itself grant Execution Authorization. If the proposed implementation later requires a new control plane, new credential trust boundary, Dify unfreeze, Broker authority expansion, or another material architectural departure beyond DR-0011, implementation MUST stop and the architecture decision must be revised or supplemented before proceeding.

## 8. Acceptance criteria

S-0009 v0.2 is implementation-ready only when an independently reviewed Draft demonstrates that:

- reviewer and writer/executor contracts are separate;
- actor independence is explicit: Grok/xAI cannot be the sole independent reviewer of Grok/xAI-produced work;
- request-time, reviewed, and acceptance-time exact HEAD are bound and stale reviews are invalidated;
- consequential-gate reviewer evidence must be durably recorded in GitHub by the trusted Genesis side with exact reviewed HEAD before use;
- input context is bounded and secret-free;
- output is structured, finding severity/disposition is machine-checkable, every blocking finding forces a non-gate-safe result, and contradictory combinations fail closed;
- `HIGH`/`CRITICAL` findings are always blocking, while `APPROVE_WITH_FINDINGS` can be gate-safe only when every finding is explicitly non-blocking and all other invariants hold;
- Grok/xAI has no GitHub write authority or GitHub credentials;
- future implementation file boundaries, dependencies, assumptions, verification methods, output artifacts, and Decision Record necessity are explicit;
- DR-0011 remains the accepted architecture boundary before implementation EA can be exercised;
- GitHub remains the durable Source of Record;
- Qodo is optional temporary scaffolding, not a dependency;
- DR-0008 quarantine/default-off restrictions remain intact;
- Specification Approval, implementation EA, first LIVE xAI call, Ready, merge, secrets, deploy and quarantine removal remain separate gates.

## 9. Explicit non-goals

This specification does not authorize or require implementation code or tests; any xAI/Grok API call; secrets inspection, creation, rotation, or transfer; authenticated Broker calls; Dify or Cloudflare operations; deployment or LIVE activation; GitHub Actions, PAT additions, custom transport, or a new control plane; multi-agent mesh, voting, debate, or always-on advisory swarm; modification of S-0005 or existing runtime code in this specification step; removal of Qodo before a replacement is proven; Ready or merge of an implementation PR.

## 10. Gates and next step

Current state: **Draft Revision 1 / DR-0011 Accepted / Execution Authorization NOT_GRANTED**.

S-0009 supersedes S-0008 Revision 1 because independent review found that the required persistence-before-use behavior changes acceptance criteria and therefore must be represented as a new Specification rather than a revision of S-0008. S-0008 preserves the historical CEO approval against reviewed HEAD `0cdf9b50287e1c1250cbcd2fdcb4c3ab25f0023d`; that approval does **not** transfer to S-0009. DR-0011 remains Accepted because the new specification stays within the same accepted reviewer-only architecture boundary.

Required sequence from here:

1. independent exact-HEAD review of Draft S-0009;
2. separate explicit CEO Specification Approval for S-0009 if review is acceptable;
3. controlled docs promotion of S-0009 to Approved;
4. separate CEO Execution Authorization for bounded implementation;
5. implementation and independent exact-HEAD review whose consequential-gate evidence is durably persisted in GitHub before use;
6. separate CEO gates for any secret operation, authenticated Broker use/quarantine removal, deployment, or first LIVE xAI call as applicable.

No successful step implicitly authorizes the next one.
