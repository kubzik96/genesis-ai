# One-Window Executor Handoff Discovery

Status: Draft discovery evidence for Issue #45.

Baseline: `2258e312107c9d3d05eb4afb379cfc070e3d26d7`.

## Objective

Remove the remaining manual CEO copy/paste step between the Genesis orchestrator and a cloud coding executor while preserving GitHub as durable Source of Record and preserving CEO authority for consequential actions.

## Capability matrix

| Path | Status | Evidence |
|---|---|---|
| Current ChatGPT GitHub connector: launch/assign cloud coding agent | **BLOCKED** | The connector exposes Issue/PR/repository writes but no dedicated agent-task launch action. A bounded attempt to create Issue #46 already assigned to `copilot-swe-agent[bot]` was rejected by GitHub with HTTP 422 (`assignees copilot cannot be assigned to this issue`). Creating Issue #46 succeeded without the assignee, but a second bounded assignment attempt through the connector returned HTTP 403. No executor session or PR was created. |
| GitHub Copilot cloud agent via GitHub API | **AVAILABLE IN PLATFORM, NOT AVAILABLE THROUGH CURRENT CONNECTOR AUTH/ACTION** | Current GitHub documentation supports assigning Issues to Copilot cloud agent through REST/GraphQL and states that assignment starts work and produces a PR. The required API path/auth/agent-assignment surface is not exposed by the current connected action used in the probe. |
| Installable ChatGPT plugin/connector that directly launches Codex/cloud coding work | **NOT EXPOSED** | Connector/plugin discovery found no dedicated installed or installable Codex/cloud-coding executor action suitable for this handoff. An OpenAI developer-reference plugin is not an executor launch surface. |
| Local Codex install | **KNOWN BLOCKED / DO NOT REPEAT** | Existing Memory V1 records the local Codex install/local-executor path as unavailable/failed in the CEO environment unless new evidence changes that condition. |
| Dify/Broker executor path | **DEFERRED / NOT REQUIRED** | One-Window MVP explicitly treats Dify as optional/non-blocking. Reopening this path would add unnecessary infrastructure and intersects frozen/quarantined work. |

## Probe result

`DIRECT_HANDOFF_PROBE: BLOCKED_BY_CURRENT_CONNECTOR`

Issue #46 was created specifically as a safe docs-only handoff probe. The orchestrator attempted to launch Copilot by Issue assignment without CEO copy/paste. GitHub rejected assignment through the currently available connector path, first during Issue creation and then on the existing Issue. Issue #46 was closed as `not_planned`; no code, workflow, runtime, secrets, deploy, Dify, Broker HTTP, Cloudflare, LIVE, Ready, merge, or executor-created PR occurred.

## Recommended minimal path

Do **not** build a new executor runtime and do **not** return to Dify.

The smallest architecture is:

`Genesis orchestrator → GitHub Issue → supported GitHub Copilot cloud-agent assignment API → agent-created Draft PR → Genesis verification/review → CEO gate for merge`

The missing component is narrow: the ChatGPT/GitHub connected action must expose a supported Copilot cloud-agent assignment/task-launch operation with the required GitHub user-to-server authorization and optional agent-assignment parameters. Repository editing, Issue creation, PR inspection, review, and merge gating already exist.

## Integration boundary

A future implementation should add only one bounded capability to the orchestrator tool surface:

- input: repository, Issue number or bounded task, base branch, optional custom instructions;
- action: supported GitHub cloud-agent assignment/task launch;
- output: immutable task/session identifier plus linked Issue/PR when available;
- default authority: may create/assign task and allow an agent to produce a Draft PR; must not Ready, merge, deploy, access secrets, or activate production;
- verification: Genesis independently verifies exact PR HEAD/diff and records the result in GitHub;
- failure behavior: fail closed and preserve the Issue as evidence; never fall back to local Codex installation or Dify automatically.

## What is already solved

Memory V1 is now merged into `main`, so a new Genesis session can recover project state without CEO history copy/paste. The unresolved problem is no longer project memory; it is specifically the executor-launch capability.

## Memory impact

`Memory impact: NO` for this discovery document itself. Durable Memory V1 should be updated only after the direct executor path is actually enabled and proven end-to-end, or if the blocker materially changes.

## Authority boundary

This discovery proposes no merge, deploy, secrets, LIVE, Dify, Broker HTTP, Cloudflare, production runtime, or standing write authority. Any implementation of the missing executor-launch action requires its own bounded work item and review; consequential actions remain CEO-gated.
