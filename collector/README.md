# Collector gateway

NoxAlert uses the upstream OpenTelemetry Collector Contrib distribution as its public OTLP edge. Do not replace it with a custom Worker decoder.

The production configuration will be added with the first ClickHouse environment and pinned to an image digest. It must include:

- OTLP/gRPC and OTLP/HTTP receivers with TLS
- authentication before tenant enrichment
- request and per-tenant rate limits at the edge
- `memory_limiter` as the first processor
- resource normalization, PII redaction, and bounded attribute transforms
- batch processing with explicit maximum sizes
- ClickHouse exporter queue, retry/backoff, and persistent storage
- collector self-metrics for queue utilization, refused telemetry, exporter failure, and ingest lag
- health/readiness endpoints and graceful draining during rollout

Keeping the exact config out until the real endpoint, schema, and pinned collector version exist avoids a sample configuration accidentally becoming production infrastructure.
