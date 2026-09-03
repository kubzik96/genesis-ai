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

DR-0008 quarantine remains authoritative. This specification does not lift quarantine, authorize authenticated Broker calls, rotate credentials, unfreeze Dify, deploy anything, or authorize LIVE xAI calls.

## 3. Review input contract

A review request MUST bind to:

- repository: exactly `kubzik96/genesis-ai`;
- PR number;
- exact expected 40-character PR HEAD SHA;
- bounded unified diff and changed-file metadata for that exact HEAD;
- only canonical GitHub context strictly necessary to judge the requested change;
- explicit review criteria and known task/specification acceptance criteria when applicable.

The orchestrator MUST verify the actual PR HEAD before preparing the request. If HEAD changes before the review result is accepted, the result is stale and a new separately permitted review is required.

Secrets, PATs, service tokens, authorization headers, private execution payloads, raw sensitive logs, and unrelated repository context MUST NOT be included.

## 4. Structured output contract

The reviewer response MUST be machine-checkable and contain at minimum:

```text
VERDICT: APPROVE | APPROVE_WITH_FINDINGS | REQUEST_CHANGES | BLOCKED
HEAD_CONFIRMED: YES | NO
SCOPE: CLEAN | NOT_CLEAN
FINDINGS:
- <severity>: <concise finding with evidence>
READY_GATE_SAFE: YES | NO
STOP
```

Findings SHOULD cite file/path and relevant evidence. Unknown or malformed verdict fields are treated as `BLOCKED`.

`APPROVE` or `READY_GATE_SAFE: YES` is advisory evidence only. It does not mark a PR Ready, merge it, grant Specification Approval, grant Execution Authorization, authorize deployment/secrets/LIVE, or chain any later CEO gate.

## 5. Fail-closed requirements

The review MUST stop without an approval recommendation when any of the following applies:

1. actual PR HEAD does not equal expected HEAD;
2. repository or PR identity cannot be verified;
3. required diff/context is unavailable, truncated beyond the bounded review contract, or exceeds configured limits;
4. output violates the structured response contract;
5. requested review would require GitHub credentials or write authority to be exposed to Grok/xAI;
6. authentication, quarantine, secret-handling, or LIVE state is uncertain;
7. the request attempts to expand reviewer authority into execution, GitHub writes, merge, deploy, secret operations, or another control plane.

A fail-closed result MUST NOT be interpreted as approval.

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

## 7. Minimum useful implementation after future approval

After Specification Approval and a separate Execution Authorization, the minimum implementation SHOULD be a thin reviewer-only contract that:

1. receives an already verified repository/PR/exact-HEAD review request from Genesis;
2. obtains or is supplied only bounded read context;
3. makes one bounded xAI review request under a default-off/live gate;
4. validates the structured response;
5. returns the advisory result to Genesis;
6. performs zero GitHub writes and STOPs.

Implementation SHOULD reuse existing safe read/validation primitives where compatible, but MUST NOT broaden the S-0005 writer endpoint or inherit its write authority merely for convenience.

## 8. Acceptance criteria

S-0008 v0.1 is implementation-ready only when an independently reviewed revision demonstrates that:

- reviewer and writer/executor contracts are separate;
- exact-HEAD binding and stale-review invalidation are explicit;
- input context is bounded and secret-free;
- output is structured and fail-closed;
- Grok/xAI has no GitHub write authority or GitHub credentials;
- GitHub remains the durable Source of Record;
- Qodo is optional temporary scaffolding, not a dependency;
- DR-0008 quarantine/default-off restrictions remain intact;
- Specification Approval, implementation EA, first LIVE xAI call, Ready, merge, secrets, deploy and quarantine removal remain separate gates.

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
- modification of S-0005 or existing runtime code;
- removal of Qodo before a replacement is proven;
- Ready or merge of an implementation PR.

## 10. Gates and next step

Current state: **Draft / Execution Authorization NOT_GRANTED**.

Required sequence:

1. independent review of this exact specification Draft PR;
2. separate CEO Specification Approval;
3. promotion of the approved specification through the repository's controlled documentation workflow;
4. separate CEO Execution Authorization for bounded implementation;
5. implementation and independent exact-HEAD review;
6. separate CEO gates for any secret operation, authenticated Broker use/quarantine removal, deployment, or first LIVE xAI call as applicable.

No successful step implicitly authorizes the next one.