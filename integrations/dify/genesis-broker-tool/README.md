# Private Genesis Broker Tool Plugin

Review-only Dify plugin candidate for the fixed `genesis-broker` boundary.

## Current slice

- provider credential: raw `BROKER_SERVICE_TOKEN` through `secret-input` only;
- local credential-format validation with no request;
- one read-only `context_read` tool;
- fixed Broker origin and local context-path allowlist;
- no logging, returning, or exception interpolation of the Authorization header or credential;
- no write tools, generic proxy, configurable host, install, upload, Dify run, or publish.

The plugin constructs `Authorization: Bearer <raw token>` only inside the transport call. Do not paste the `Bearer` prefix into the provider credential field.

## Local verification

From this directory, without installing the Dify SDK:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q genesis_broker provider tools main.py tests
```

Packaging, installation, credential entry, Dify execution, and publication require separate authorization. This draft must not be treated as an approved architecture or production artifact.
