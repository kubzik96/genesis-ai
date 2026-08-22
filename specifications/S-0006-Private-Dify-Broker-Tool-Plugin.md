# S-0006 — Private Dify Genesis Broker Tool Plugin

| Field | Value |
|---|---|
| Status | **Approved** |
| Revision | 1 |
| Date | 2026-08-23 |
| CEO Approval | **Granted 2026-08-23 for Revision 1** |
| Execution Authorization | Limited CODE_ONLY candidate authorized for one Draft PR; no operational actions |

## Goal

Provide a reviewable private Dify Tool Plugin candidate that moves Broker authentication out of raw workflow HTTP nodes while preserving the fixed Broker boundary.

## Scope

- plugin path `integrations/dify/genesis-broker-tool/`;
- provider credential declared as `secret-input` only;
- raw 64-character service token format and local-only validation;
- internal Bearer-header construction;
- fixed Broker origin and exact context allowlist;
- one read-only `context_read` tool;
- unit and source-contract tests with no network;
- approved architecture documentation and DR-0009.

## Out of scope

- write tools, generic proxy, configurable origin, OAuth, or storage;
- real credentials or secret migration;
- installation, packaging upload, Dify configuration/run/publish;
- Broker HTTP, Cloudflare, deployment, activation, GitHub/xAI runtime calls;
- Ready or merge.

## Security requirements

1. Credential appears only in provider `secret-input` and runtime memory.
2. Credential is absent from tool parameters and outputs.
3. Provider validation performs no network call.
4. Runtime code does not log or print request/credential data.
5. Errors expose only stable safe codes and optional HTTP status.
6. The exact credential and sensitive response keys are removed from returned data.
7. Unknown paths stop before transport.

## Acceptance criteria

- all local unit/contract tests pass;
- Python sources compile;
- source scan finds no real secret and no credential field in tool YAML;
- Git diff contains only plugin code/tests and architecture/specification records;
- PR remains Draft and has no operational side effect.

## Later gates

CEO Approval covers only the existing CODE_ONLY candidate. It does not authorize Ready, merge, plugin packaging/upload/install, credential entry, Dify configuration/run/publish, Broker HTTP, Cloudflare or secret operations, deployment, activation, or live GitHub/xAI runtime calls. Any operational use requires a separate CEO gate. Any write tool is a scope expansion and requires a new approved revision or specification.
