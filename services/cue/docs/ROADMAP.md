# NoxCue roadmap

## V1 — daily health and immediate errors

- Create a source and browser/server ingest keys in NoxConnect.
- Submit explicit `error.occurred` cues for immediate Slack delivery.
- Group errors by an explicit or deterministic fingerprint and cool down repeats.
- Emit closed `user.registered` and `user.active` events; NoxCue derives standardized user counts.
- Store 20 versioned reported/calculated metric definitions in NoxConnect.
- Calculate growth, activation, login success, and DAU/MAU stickiness.
- Send exactly one Slack health brief after each source’s local day ends.
- Show daily values, digest delivery state, and recent error groups in NoxConnect.
- Automatically attach bounded timing, source, environment, release, runtime,
  sanitized URL, and redacted error evidence to user-journey failures.
- Present likely causes and possible fixes without attempting remediation.

Exit condition: a customer copies two payloads, receives a failure immediately,
receives one local-time daily brief, and can explain every displayed value from
the metric catalog.

## After V1 — activity model

- Opaque actor-level activity events and server-side unique-user calculation.
- Retention, cohorts, sessions, funnels, or arbitrary product events only after
  the activity boundary is designed explicitly.
- Source-specific destinations, exports, and additional delivery channels.

Logs, traces, OTLP, telemetry queries, and general alert-rule engines remain
outside NoxCue’s scope. Automated remediation, product retries, and inferred
recovery also remain outside its scope: NoxCue detects and explains.
