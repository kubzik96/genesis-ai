# Draft Architecture — Private Dify Genesis Broker Tool Plugin

**Status:** Draft / review candidate  
**Date:** 2026-08-23  
**Operational effect:** none

## Goal

Replace raw HTTP nodes that can expose request headers in Dify execution details with a private Tool Plugin boundary. The plugin owns construction of the Broker Authorization header and exposes only typed, allowlisted operations.

## First vertical slice

The CODE_ONLY candidate implements `context_read` only:

- fixed origin: `https://genesis-broker.genesis-ai-kubzik96.workers.dev`;
- exact local copy of the deployed Broker context allowlist;
- provider credential `broker_service_token` declared only as `secret-input`;
- provider credential value is the raw 64-character token, not a prebuilt header;
- `Authorization: Bearer <raw token>` is constructed only at the transport boundary;
- credential validation checks format locally and makes no network request;
- responses are recursively stripped of credential-bearing keys and the exact token is redacted from strings;
- runtime code has no logger or print path.

Write tools, configurable origins, arbitrary paths, generic HTTP proxying, OAuth, storage, installation, upload, Dify runs, and publication are out of scope.

## Trust boundaries

1. Dify stores the raw token as an encrypted provider credential.
2. The plugin runtime receives the credential and creates the header in memory.
3. Only the fixed Broker origin can receive that header.
4. The tool returns safe JSON without headers, request objects, credential values, or raw transport errors.
5. Broker continues to enforce authentication, repository/path allowlists, gates, idempotency, rate limits, and upstream access.

The plugin does not prove CEO identity and does not weaken Broker gates.

## Credential migration

The existing workflow variable form `BROKER_AUTHORIZATION=Bearer <raw>` is not reused by the plugin. At a separately authorized final credential operation, the provider field receives only the same raw token. No secret value may enter Git, chat, Issue, PR, exported workflow, screenshots, logs, or test fixtures.

## Quarantine and activation

This draft does not lift DR-0008 quarantine. It authorizes no plugin install/upload, credential entry, Dify change/run/publish, Broker HTTP, Worker change, secret operation, deployment, activation, or live GitHub/xAI call.

Before any Dify execution, require separate approval for:

1. independent review of the exact PR HEAD;
2. architecture/specification approval;
3. private installation without publication;
4. credential entry through provider `secret-input`;
5. one isolated safe-output/masking verification;
6. only then, a separately gated workflow integration.

## Verification strategy

Local tests prove:

- valid and invalid credential shapes without networking;
- denied paths stop before transport;
- header construction remains internal;
- responses and safe errors do not contain the test credential or Authorization field;
- provider manifest uses `secret-input` and tool parameters contain no credential;
- provider validation imports no network primitive;
- runtime source contains no logging or print calls.

Tests use synthetic values only and do not contact Dify, Broker, GitHub, xAI, or Cloudflare.
