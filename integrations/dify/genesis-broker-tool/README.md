# Private Genesis Broker Tool Plugin

CODE_ONLY Dify plugin 0.1.4 candidate for the fixed `genesis-broker` boundary.

## Current slice

- provider credential: raw `BROKER_SERVICE_TOKEN` through `secret-input` only;
- local credential-format validation with no request;
- one read-only `context_read` tool;
- fixed Broker origin and local context-path allowlist;
- no logging, returning, or exception interpolation of the Authorization header or credential;
- fixed `Accept: application/json` and `User-Agent: GenesisBrokerDifyPlugin/0.1.4`
  request headers;
- exact runtime dependency pin `dify-plugin==0.9.0` so package/runtime review uses the SDK version covered by the existing serialization evidence;
- declared workflow output schema with named variable messages instead of a single
  JSON runtime envelope;
- approved repository content is emitted only as the normal `content` output variable,
  never inside plugin-generated errors;
- separate safe error codes for Broker JSON errors, non-JSON HTTP responses, and
  transport failures;
- non-JSON diagnostics expose only HTTP status and the coarse content-type class;
- no write tools, generic proxy, configurable host, install, upload, Dify run, or publish.

The plugin constructs `Authorization: Bearer <raw token>` only inside the transport call. Do not paste the `Bearer` prefix into the provider credential field.

## 0.1.4 deterministic SDK compatibility candidate

Plugin 0.1.3 allowed `dify-plugin>=0.9.0,<1.0.0`, while the real SDK serialization evidence used `dify-plugin==0.9.0`. A fresh resolver can therefore select a different SDK release than the one covered by that evidence.

Version 0.1.4 removes this diagnostic ambiguity by pinning `dify-plugin==0.9.0` in both runtime dependency declarations. Tool behavior, the declared output schema, the Broker boundary, and safe error handling remain unchanged from 0.1.3.

This is a reproducibility and compatibility candidate only. It does not establish SDK drift as the root cause of the Dify Tool-node failure, and it does not establish downstream Dify success. That outcome remains unverified until a separately authorized consumer-level check.

## Local verification

From this directory:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q genesis_broker provider tools main.py tests
```

The architecture is approved by DR-0009 and S-0006 Revision 1. This 0.1.4 code
candidate does not authorize installation, credential entry, Dify execution,
publication, Broker calls, deployment, secrets operations, or activation.
