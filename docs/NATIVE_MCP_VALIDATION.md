# Native MCP draft validation

Validated locally on 2026-10-23 against source baseline
`69985fc1623ccda050d46cb6d03fe9b937a2ddfe`. This is a draft integration, not an
activated connection or production readiness certification.

## Completed

- After the two protocol-error corrections: **67 focused tests passed in 3 files**
  (58 adapter, 7 native-route and 2 package/configuration tests). Six precise
  regressions cover error ID omission, optional envelope params, required metadata,
  readable safe IDs and credential-ID rejection.
- Before that two-file correction, the complete scoped gateway suite passed
  **141 tests in 15 files**, including 80 existing gateway tests. Those 80 were
  not rerun after the correction; a 147-test full-suite pass is not claimed.
  The older 41-test prototype is not the validation result for this interface.
- Scoped full gateway TypeScript check passed again after the correction, including the adapter and
  native dispatch. Gateway sources and required shared packages were hydrated
  from the pinned commit; a complete application checkout was not used.
- ESLint passed again for the TypeScript implementation and native-route tests.
- Before the protocol-error correction, the native Worker dry-run bundle passed
  with a one-file fixture asset directory. That bundle has not been rerun on the
  corrected adapter. It was not a real web asset build, deployment, or live binding
  validation.
- OpenAPI standardizer check passed. `/mcp` is documented using the top-level
  `x-mcp` extension, not misrepresented as a generated REST/CLI operation.
- Main remained at the pinned SHA immediately before the blocked publication attempt. The inspected
  pull-request workflow runs verification only; no workflow was changed.

## Independent review and protocol correction

Independent inspection of the earlier product-domain snapshot verified all 16
file hashes and passed its 61 focused tests. It found no tenant/scope/write bypass
and verified the token-bound incident path and org/project-filtered unresolved
LIMIT 50 SQL. It identified two MCP 2026-07-28 error-shape defects:

- An unidentified error returned `id: null`; it must omit `id`.
- An otherwise valid envelope without `params` returned invalid-request instead
  of the required metadata-missing `-32602` with HTTP 400 and the safe request ID.

Both are corrected locally, retaining strict envelopes, safe-ID bounds and
credential-ID rejection. The corrected adapter SHA-256 is
`e15063fc349b1bf3689b41b5913595974edd1db70f1f689e311bdabbf94cc28f`.
The final two-file delta was reviewed and accepted for local draft replacement
after the 67-test, TypeScript and lint pass. This is not activation approval. No
additional authorization or resource route was introduced by the correction.

References: [MCP error schema](https://modelcontextprotocol.io/specification/2026-07-28/schema#jsonrpcerrorresponse)
and [required metadata](https://modelcontextprotocol.io/specification/2026-07-28/basic/index).

## Toolchain qualification

Local available versions were TypeScript 6.0.3, Vitest 5.0.1, Zod 4.6.5,
ESLint 10.11.0 and Wrangler 4.135.0, not the repository's exact locked versions.
Locked-dependency CI remains required. The available newer ESLint flags an
existing `downstreamOk` assignment in the gateway entrypoint; the same diagnostic
was reproduced on the pristine pinned entrypoint. No unrelated fix was made.

## Still required before activation

1. Complete locked checkout CI, including real web assets and all repository
   contracts, docs, tests and Worker dry-runs.
2. Explicit deployment approval and effective edge rate limits plus bounded
   upstream timeouts. No distributed limiter is introduced in this change.
3. Authorized staging reads and denial cases for foreign tenants/resources,
   missing scopes, suspended organizations, disabled projects, expired/revoked
   tokens and oversized responses. No credentials were created for local tests.
4. Actual MCP client interoperability, private-plugin host ingestion and secure
   API-key entry verification. No plugin was created or connected.

The optional incident scope is not granted by this code. Spots listing, Growth,
Usage and privileged Admin remain unavailable. Adding authorization for those
surfaces requires a separate reviewed and explicitly approved change.

**Never merge for a staging-only test:** successful main CI automatically deploys
staging and then production. No merge, deploy, dispatch, token, scope grant,
plugin connection or live project mutation is part of this validation.
