# NoxHere services

Each directory is an independently testable service boundary inside the single
NoxHere product. A service owns its domain behavior, tests, runtime
configuration, and operational documentation. Services exchange versioned RPC,
event, or transport envelopes; they do not import another service's private
implementation.

| Service | Product area | Responsibility |
| --- | --- | --- |
| `gateway` | Public platform | Authentication, authorization, control plane, and private routing |
| `connections` | Connections | Provider identity, credentials, email, GitHub and Slack execution |
| `activity` | Activity | Activity projections, summaries, narration, and release notes |
| `planning` | Planning | Features, specifications, priority, links, and attachments |
| `telemetry` | Stats and Incidents | Telemetry, feature health, incidents, metrics, and SDKs |
| `scheduler` (background worker) | Platform operations | Queue consumption, reconciliation, recovery, and scheduled jobs |
| `feedback` | Feedback | Public capture, screenshots, feedback rendering, and resolution responses |

Provider credentials remain exclusive to Connections and the platform transport
executors.
