# One-Window Executor Handoff Discovery

Status: Accepted discovery evidence from Issue #45, with an Issue #52 product-capability update pending review.

Original discovery baseline: `2258e312107c9d3d05eb4afb379cfc070e3d26d7`.
Latest verified accepted main: `7dcef63cdcb71663ff2afd3631f6d4e9da6bb451`.

## Objective

Remove the remaining manual CEO transfer between the Genesis orchestrator and a cloud executor while preserving GitHub as durable Source of Record and preserving CEO authority for consequential actions.

## Evidence after Trial #2

Trial #2 materially narrowed the problem:

- a fresh ChatGPT Work cloud executor received one bounded task rather than project history;
- it recovered Genesis context from GitHub Long-Term Project Memory and the minimum linked canonical artifacts;
- it created Issue #48 and Draft PR #49 without asking the CEO to restate project history;
- PR #49 changed only `MEMORY.md`, was independently verified/reviewed, then separately authorized Ready and squash-merged;
- Issue #48 closed as `completed`;
- the accepted merge commit is `2942cedc9fdcbdfcb3c62325370b61b49c844057`.

Therefore project-memory recovery and the cloud executor itself are no longer the primary blockers. The remaining One-Window blocker is specifically **transport/launch**: the CEO still had to send one bounded task from the Genesis orchestrator chat to ChatGPT Work.

Trial #2 is a PASS for self-recovering executor workflow. It is **not** a full One-Window PASS.

## Product-native launch evidence for Issue #52

Official OpenAI documentation now exposes a narrower product-native candidate that was not recorded in the original discovery:

- [Codex cloud](https://learn.chatgpt.com/docs/cloud) documents starting work from GitHub pull requests **and issues**;
- the [OpenAI changelog](https://learn.chatgpt.com/docs/changelog) states that an `@codex` mention in a GitHub Issue can kick off a task;
- [Work event-triggered tasks](https://learn.chatgpt.com/docs/automations) remain documented around supported pull-request activity and are still not evidence of an initial Issue/new-task trigger.

This proves that a product-native **GitHub Issue → Codex cloud** launch surface exists in the supported product. It does not prove that the `kubzik96/genesis-ai` repository and current account are eligible and correctly authorized, because Issue #52 permits discovery only and no `@codex` launch was attempted.

## Capability matrix

| Path | Status | Evidence |
|---|---|---|
| ChatGPT Work as Genesis cloud executor | **PROVISIONALLY AVAILABLE / PROVEN IN TRIAL #2** | Work completed the bounded Trial #2 from GitHub-backed memory without CEO history restatement and produced a verifiable Issue + Draft PR. One manual CEO send into Work remained. |
| Current main-chat GitHub connector: directly launch ChatGPT Work | **NOT EXPOSED** | The currently available GitHub actions can manage repository artifacts but expose no action that starts a Work chat/task from this orchestrator conversation. |
| GitHub Issue `@codex` → Codex cloud initial task | **ACCOUNT-OR-UI CHECK NEEDED** | Official OpenAI documentation now says Codex cloud work can start from GitHub Issues and that `@codex` can kick off an Issue task. No Genesis repository/account launch has been attempted or proven. |
| ChatGPT Work event-triggered task from GitHub | **AVAILABLE FOR SUPPORTED PR ACTIVITY, NOT A PROVEN INITIAL-TASK TRANSPORT** | Current OpenAI product documentation supports webhook-based Work tasks triggered by GitHub pull-request activity in an authorized repository. Documented triggers begin from PR activity, so this does not by itself prove a way to launch the initial coding executor before a PR exists. |
| Current ChatGPT GitHub connector: launch/assign GitHub Copilot cloud agent | **BLOCKED** | Issue #46 probe: assignment to `copilot-swe-agent[bot]` failed through the current connector path (HTTP 422 during create-with-assignee; HTTP 403 on later assignment). No executor session or PR was created. |
| GitHub Copilot cloud agent via GitHub platform API | **AVAILABLE IN PLATFORM, NOT EXPOSED THROUGH CURRENT CONNECTOR PATH** | Platform documentation supports cloud-agent task/assignment mechanisms, but the required launch surface is not available through the currently connected action set and the repository UI probe did not offer Copilot as an assignee. |
| Installable ChatGPT plugin/connector that directly launches a cloud coding executor | **NOT EXPOSED IN PRIOR DISCOVERY** | Prior plugin/connector discovery found no dedicated launch action suitable for the initial handoff. Re-check only when product capability changes or new evidence appears. |
| Local Codex install | **KNOWN BLOCKED / DO NOT REPEAT** | Long-Term Project Memory records the local Codex install/local-executor path as failed/unavailable in the CEO environment unless new evidence changes that condition. |
| Dify/Broker executor path | **FROZEN / NOT REQUIRED FOR CURRENT MVP** | Dify remains optional/non-blocking; reopening it would add infrastructure and intersects frozen/quarantined work without solving the proven smallest remaining blocker more directly. |

## Current conclusion

Do **not** build a new executor runtime merely to remove one manual send. Do **not** return to Dify for this problem.

A product-native initial-launch candidate now exists in official documentation:

`bounded GitHub Issue with @codex → Codex cloud task`

Its Genesis account/repository eligibility and end-to-end behavior remain unproven. Therefore the manual-send blocker is narrowed, but not removed, and One-Window transport must not yet be called solved.

The currently proven operating path is:

`CEO → Genesis orchestrator → one bounded manual send → ChatGPT Work executor → GitHub Issue/Draft PR → Genesis verification + independent review when required → CEO consequential gate`

The preferred target path is now:

`CEO → Genesis orchestrator → bounded GitHub Issue with @codex → Codex cloud executor → Draft PR → Genesis verification + independent review when required → CEO consequential gate`

ChatGPT Work is therefore the **provisional default cloud executor**, not a claim that One-Window transport is solved.

## Smallest missing capability

Only one narrow proof is still missing:

- eligibility: the current OpenAI/GitHub account and `kubzik96/genesis-ai` repository accept the documented Issue `@codex` launch;
- input: one bounded Issue that points the executor to current `main` and `MEMORY.md` rather than carrying project history;
- action: the Issue mention starts exactly one authorized Codex cloud task;
- output: durable task/session evidence and one bounded Draft PR when requested;
- default authority: executor may perform only the bounded task and create reviewable artifacts; it must not Ready, merge, deploy, access secrets, or activate production unless separately authorized;
- verification: Genesis independently verifies GitHub artifacts and exact PR HEAD/diff;
- failure behavior: fail closed; do not silently fall back to local Codex, Dify, secrets, or a new runtime.

A GitHub-PR-triggered Work task may later be useful for **post-PR** review, monitoring, or follow-up automation, but it should not be mislabeled as the initial executor-launch solution unless an end-to-end trial proves that behavior.

## Next bounded investigation

Prefer product-native transport over custom infrastructure. In order:

1. under a separate authorization, perform a read-only account/repository eligibility check for the documented GitHub Issue `@codex` surface;
2. if exposed, use a separately bounded probe Issue whose executor may create only one docs-only Draft PR and must recover context from current `main`/`MEMORY.md`;
3. if the surface is absent or the probe fails, preserve the evidence and continue the single bounded manual send without retries or custom transport;
4. do not implement an adapter, token bridge, Dify path, or custom executor runtime merely to remove the single manual send without a separate architecture/CEO gate.

## Memory impact

`Memory impact: NO` for this discovery-only update. Official documentation identifies a candidate, but the Genesis blocker does not materially change until repository/account eligibility and an end-to-end initial launch are proven.

Do not encode the candidate as a working transport solution in Memory until that direct path is proven end-to-end.

## Authority boundary

This discovery proposes no agent launch, Ready, merge, deploy, secrets, LIVE, Dify, Broker HTTP, Cloudflare, production runtime, or standing write authority. Any eligibility probe or execution of the Issue `@codex` launch requires a separately bounded work item and the applicable review/CEO gates.
