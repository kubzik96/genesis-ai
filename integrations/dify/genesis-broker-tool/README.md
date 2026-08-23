# Private Genesis Broker Tool Plugin

CODE_ONLY Dify plugin 0.1.3 candidate for the fixed `genesis-broker` boundary.

## Current slice

- provider credential: raw `BROKER_SERVICE_TOKEN` through `secret-input` only;
- local credential-format validation with no request;
- one read-only `context_read` tool;
- fixed Broker origin and local context-path allowlist;
- no logging, returning, or exception interpolation of the Authorization header or credential;
- fixed `Accept: application/json` and `User-Agent: GenesisBrokerDifyPlugin/0.1.3`
  request headers;
- declared workflow output schema with named variable messages instead of a single
  JSON runtime envelope;
- approved repository content is emitted only as the normal `content` output variable,
  never inside plugin-generated errors;
- separate safe error codes for Broker JSON errors, non-JSON HTTP responses, and
  transport failures;
- non-JSON diagnostics expose only HTTP status and the coarse content-type class;
- no write tools, generic proxy, configurable host, install, upload, Dify run, or publish.

The plugin constructs `Authorization: Bearer <raw token>` only inside the transport call. Do not paste the `Bearer` prefix into the provider credential field.

## 0.1.3 output-contract compatibility candidate

Plugin 0.1.2 returned one valid Dify JSON tool message. The captured runtime envelope
reported `code=0` and `message=success`, carried the result under
`data.type=json` / `json_object`, and was nevertheless displayed as a failed Tool
node. Local SDK reproduction confirms that both the former JSON message and the new
variable messages serialize successfully, so it does not establish the downstream
Dify failure's root cause.

Version 0.1.3 is a bounded compatibility candidate: it declares an `output_schema`
and emits named variable messages, making successful repository content available
only through the normal `content` output. Whether this changes the Dify Tool-node
outcome remains unverified until a separately authorized consumer-level check.

## Local verification

From this directory, without installing the Dify SDK:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q genesis_broker provider tools main.py tests
```

The architecture is approved by DR-0009 and S-0006 Revision 1. This 0.1.3 code
candidate does not authorize installation, credential entry, Dify execution,
publication, Broker calls, deployment, secrets operations, or activation.
