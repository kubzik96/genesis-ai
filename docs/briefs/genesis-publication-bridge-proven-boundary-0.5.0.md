# Genesis Publication Bridge Proven Boundary 0.5.0

## Accepted baseline

The exact accepted baseline for this artifact is `c20402afe71b23dfc264927fc2b7316d8ae2130d`.

## Proven boundary

- Issue #103 proved a deterministic `GENESIS_RESULT_PACKAGE_V0` handoff for one controlled tiny file.
- Draft PR #104 proved Genesis-side exact-byte materialization and programmatic Draft publication for that bounded one-file package.
- The later bounded pre-night candidate was also successfully materialized and accepted as the baseline above through PR #107.
- These cases prove only the controlled, bounded Result Package to Genesis materialization to Draft publication shape. They do not establish a new production capability.

## Explicitly unproven

- Arbitrary, general, or multi-file publication remains unproven.
- Task-side Codex publication remains unavailable in observed environments.

## Trust split

1. Genesis verifies the GitHub Source of Truth.
2. Codex transforms the exact supplied baseline and evidence within the authorized path boundary.
3. Codex returns a deterministic `GENESIS_RESULT_PACKAGE_V0` containing the complete result bytes and hashes.
4. Genesis independently verifies the package bytes, hashes, and paths.
5. Genesis materializes only the verified result, creates a Draft PR, and obtains review of the exact PR HEAD.

## Fail-closed rules

Stop without publication or expansion if the base is stale, a path escapes the allowlist, bytes or hashes mismatch, the requested mutation is ambiguous, or the requested publication shape exceeds the proven bounded shape. Unknown or incomplete evidence is not success.

## No authorization expansion

This evidence-hardening artifact authorizes neither Ready nor merge; services or runtime work; secrets access; Broker, Dify, or Cloudflare operations; LIVE or production calls; nor any expansion of Publication Bridge.
