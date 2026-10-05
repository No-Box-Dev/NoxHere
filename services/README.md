# NoxHere services

Each directory is an independently testable service boundary inside the single
NoxHere product. A service owns its domain behavior, tests, runtime
configuration, and operational documentation. Services exchange versioned RPC,
event, or transport envelopes; they do not import another service's private
implementation.

| Service | Product area | Responsibility |
| --- | --- | --- |
| `gateway` | Public platform | Authentication, authorization, control plane, and private routing |
| `connect` | Connections | Provider identity, credentials, email, GitHub and Slack execution |
| `feed` | Activity | Activity projections, summaries, narration, and release notes |
| `ticket` | Planning | Features, specifications, priority, links, and attachments |
| `cue` | Incidents | Telemetry, feature health, incidents, metrics, and SDKs |
| `scheduler` | Platform operations | Queue consumption, reconciliation, recovery, and scheduled jobs |
| `spot` | Feedback | Public capture, screenshots, feedback rendering, and resolution responses |

Provider credentials remain exclusive to Connect and the platform transport
executors.
