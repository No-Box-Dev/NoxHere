# NoxCue architecture

## Boundary

NoxCue receives explicit errors and bounded daily user/auth snapshots. Errors
are delivered immediately; snapshots become one calculated daily health brief.
It is not an observability or general analytics system.

- No OTLP or collector
- No logs, traces, arbitrary metric names, or raw activity stream
- No sampling, source maps, SLOs, or anomaly detection
- No inferred error grouping; fingerprints are explicit or deterministically derived
- No Slack credentials in the NoxCue Worker

## Ownership

NoxCue owns the public event endpoint, validation, ingest-key authentication,
origin checks, rate limiting, idempotency, daily formulas, error presentation,
and daily-brief presentation.

NoxConnect owns organization identity, source/key administration, the shared D1
migrations, Slack installations and routing, the delivery outbox,
the versioned metric registry, digest schedule, `noxconnect-tasks`, retries/DLQ,
delivery receipts, and event archival to R2.

## Write path

1. A publishable or secret key resolves an enabled source and authoritative org.
2. Browser origins are checked against the source's exact allowlist.
3. The payload must be `error.occurred` or `stats.daily`; daily snapshots require
   a secret server key.
4. An error updates its bounded fingerprint/day aggregates and, outside its
   cooldown, inserts a Slack outbox row.
5. A daily snapshot upserts only the ten reported catalog metrics and five
   deterministic calculated metrics. It never creates an immediate Slack row.
6. NoxConnect's 30-minute scheduled sweep closes local days, calculates the five
   error metrics, and stages exactly one daily digest per source and period.
7. NoxConnect resolves the encrypted Slack installation, delivers, and records
   the receipt. Its scheduled recovery requeues durable rows left pending.

Payloads are capped at 32 KiB. Daily snapshots allow ten named non-negative
integer inputs and a 31-day backfill window. DAU, WAU, and MAU are supplied as
unique counts until a separate activity model exists.
