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

## 0.1.3 output-contract fix

Plugin 0.1.2 returned a single JSON tool message. The observed Dify runtime envelope
reported `code=0` and `message=success`, but carried that result under
`data.type=json` / `json_object` while the Tool node was displayed as failed. Local
SDK reproduction confirmed that the Broker result itself was valid; the missing
workflow-facing contract was the compatibility seam. Version 0.1.3 declares an
`output_schema` and emits named variable messages, so successful repository content
is available only through the normal `content` output.

## Local verification

From this directory, without installing the Dify SDK:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q genesis_broker provider tools main.py tests
```

The architecture is approved by DR-0009 and S-0006 Revision 1. This 0.1.3 code
candidate does not authorize installation, credential entry, Dify execution,
publication, Broker calls, deployment, secrets operations, or activation.
