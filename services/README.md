# NoxHere services

Each directory is an independently testable service boundary inside the single
NoxHere product. A service owns its domain behavior, tests, runtime
configuration, and operational documentation. Services exchange versioned RPC,
event, or transport envelopes; they do not import another service's private
implementation.

| Service | Product area | Responsibility |
| --- | --- | --- |
| `connect` | Connections | Provider identity, credentials, email, GitHub and Slack execution |
| `cue` | Incidents | Telemetry, feature health, incidents, metrics, and SDKs |
| `scheduler` | Platform operations | Queue consumption, reconciliation, recovery, and scheduled jobs |
| `spot` | Feedback | Public capture, screenshots, feedback rendering, and resolution responses |

`feed`, `gateway`, and `ticket` join this directory as their standalone code is
imported. Provider credentials remain exclusive to Connect and the platform
transport executors.
