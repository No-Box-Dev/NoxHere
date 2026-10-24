# NoxHere product areas

The customer-facing names are Feedback, Incidents, Planning, Growth, Usage,
Delivery, and Settings. A Spot is an individual customer report within Feedback.
Delivery contains Current work, Pull requests, and Releases. Repository issues
remain available within Incidents. Settings contains connections, member roles,
guest access, integration configuration, and member tracking.

Member tracking changes workload visibility, not authorization. Roles and guest
grants are managed separately under Settings → Connections & access. Secrets
is outside this update; existing NoxKey behavior is retained.

## Compatibility

Existing service IDs, scopes, API paths, CLI/SDK namespaces, MCP tool names,
and bookmarks remain valid. In particular, Delivery retains the `activity`
identifier and Incidents retains `issues`. Historical Connections URLs remain
valid; the primary entry point is Settings → Connections & access. Unknown
project routes now fall back to that Settings view.

## Status semantics

- Growth and Usage read source state rather than claiming events are arriving.
  The views distinguish setup required, paused ingestion, missing active keys,
  waiting for events, recent activity, and no activity in the last 24 hours.
- Last accepted event uses server receipt times across registrations, active-user
  events, custom actions, and tracked website/subscription events. It is separate
  from the time the browser last checked the source API. Retention can remove
  historical receipts; no retained event is not proof of no historical traffic.
- Recent activity means an enabled source with an active key has a retained
  receipt within 24 hours. It is not continuous monitoring or a delivery SLA.
  Mixed source configurations show a partial-setup warning.
- A failed source read is unavailable status, never missing setup. Previously
  loaded timestamps are marked as such after a failed refresh. Guests may lack
  permission to inspect source administration; this is not an ingestion outage.
- Delivery's organization sync indicator uses the existing sync-state API,
  including its five-minute freshness threshold. The displayed timestamp is the
  oldest recorded organization resource sync, not a project-wide completion
  receipt or proof every expected resource has synchronized.
- Delivery keeps GitHub work available during Planning failures, explicitly
  marks workload as partial, and omits feature counts. Directory and release-note
  failures are also visible rather than being presented as complete coverage.

Status polling runs once per minute while visible. No provider credentials,
permission grants, event ingestion settings, or data retention policies change.
