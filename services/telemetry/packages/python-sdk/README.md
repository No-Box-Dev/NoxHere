# `telemetry` (compatibility package)

This package forwards to `noxhere.telemetry`. New applications should install
`noxhere`; the example below remains valid for existing applications.

Detection-first Python SDK for Telemetry. It mirrors the server surface and wire
contract of `@noxhere/telemetry-sdk`; Python has no browser entry point.

```python
from telemetry import TelemetryClient

with TelemetryClient(
    key=os.environ["TELEMETRY_SERVER_KEY"],
    environment="production",
    release=os.getenv("APP_RELEASE"),
) as telemetry:
    user = telemetry.auth.signup(lambda: auth.sign_up(input))
    telemetry.user.registered(user.id)
    telemetry.activity("custom.journals.added", user.id)
```

Direct event methods return a `DeliveryResult` and never raise due to delivery
failure. Observed operations preserve the application's return value or
exception and report their result on a background thread. Use `flush()` or the
context manager before process exit.

The unified SDK uses only the Python standard library plus `typing-extensions`
at runtime and supports Python 3.10 and newer.

## Cross-language parity

`../sdk-contract/contract.json` is the canonical protocol contract. Run:

```sh
python3 scripts/generate-sdk-contract.py
npm run sdk:parity
```

Generated constants are committed for both languages. The parity check fails
when either generated binding is stale, when the TypeScript package version
differs from the contract, or when either SDK serializes the shared wire
fixtures differently. This guarantees the declared protocol and covered wire
behavior stay aligned; it deliberately does not claim that CI can prove two
independent programs are semantically identical for every possible input.

Licensed under PolyForm Noncommercial 1.0.0.
