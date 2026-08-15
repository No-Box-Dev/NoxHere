import { describe, expect, it } from "vitest";
import {
  anyValueToString,
  attributesToMap,
  buildTags,
  flattenLogRecords,
  logRecordToBrowserError,
  nanosToIso,
  otlpLogsRequestSchema,
} from "../otlp";

const resource = {
  "service.name": "api-backend",
  "deployment.environment": "production",
  "service.version": "2026.08.15",
};

const record = {
  timeUnixNano: "1786798108000000000",
  severityText: "ERROR",
  body: { stringValue: "Report generation failed for report 8842" },
  attributes: [
    { key: "alert.domain", value: { stringValue: "report_generation_failure" } },
    { key: "error.type", value: { stringValue: "ReportGenerationError" } },
    { key: "exception.stacktrace", value: { stringValue: "Traceback...\n  raise ReportGenerationError" } },
  ],
};

describe("OTLP value decoding", () => {
  it("reads every scalar AnyValue variant as a string", () => {
    expect(anyValueToString({ stringValue: "hello" })).toBe("hello");
    expect(anyValueToString({ intValue: "42" })).toBe("42");
    expect(anyValueToString({ doubleValue: 1.5 })).toBe("1.5");
    expect(anyValueToString({ boolValue: false })).toBe("false");
    expect(anyValueToString({})).toBeUndefined();
    expect(anyValueToString(undefined)).toBeUndefined();
  });

  it("skips attributes without a scalar value", () => {
    expect(attributesToMap([
      { key: "kept", value: { stringValue: "yes" } },
      { key: "dropped", value: {} },
      { key: "missing" },
    ])).toEqual({ kept: "yes" });
  });

  it("converts nanosecond timestamps without losing the millisecond", () => {
    expect(nanosToIso("1786798108611000000")).toBe("2026-08-15T12:48:28.611Z");
    expect(nanosToIso(0)).toBeUndefined();
    expect(nanosToIso("not-a-number")).toBeUndefined();
    expect(nanosToIso(undefined)).toBeUndefined();
  });
});

describe("OTLP request decoding", () => {
  it("keeps known fields and strips collector fields we do not use", () => {
    const parsed = otlpLogsRequestSchema.parse({
      resourceLogs: [{
        schemaUrl: "https://opentelemetry.io/schemas/1.30.0",
        resource: { attributes: [{ key: "service.name", value: { stringValue: "api-backend" } }], droppedAttributesCount: 0 },
        scopeLogs: [{ scope: { name: "n1" }, logRecords: [record] }],
      }],
    });
    const flattened = flattenLogRecords(parsed);
    expect(flattened).toHaveLength(1);
    expect(flattened[0]?.resource).toEqual({ "service.name": "api-backend" });
  });

  it("flattens every scope and resource into one list", () => {
    const parsed = otlpLogsRequestSchema.parse({
      resourceLogs: [
        { scopeLogs: [{ logRecords: [record, record] }, { logRecords: [record] }] },
        { scopeLogs: [{ logRecords: [record] }] },
      ],
    });
    expect(flattenLogRecords(parsed)).toHaveLength(4);
  });

  it("tolerates an empty export", () => {
    expect(flattenLogRecords(otlpLogsRequestSchema.parse({}))).toEqual([]);
  });
});

describe("log record to error mapping", () => {
  it("maps a collector log record onto the error shape the rules use", () => {
    const error = logRecordToBrowserError(resource, record);
    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      service: "api-backend",
      environment: "production",
      release: "2026.08.15",
      occurredAt: "2026-08-15T12:48:28.000Z",
      error: {
        type: "ReportGenerationError",
        message: "Report generation failed for report 8842",
      },
      tags: { "alert.domain": "report_generation_failure" },
    });
  });

  it("falls back to severityText when no error type attribute is present", () => {
    const error = logRecordToBrowserError(resource, { ...record, attributes: [] });
    expect(error?.error.type).toBe("ERROR");
  });

  it("falls back to LogRecord when the record carries no type at all", () => {
    const error = logRecordToBrowserError(resource, { body: record.body });
    expect(error?.error.type).toBe("LogRecord");
    expect(error?.environment).toBe("production");
  });

  it("reads the message from exception attributes when the body is empty", () => {
    const error = logRecordToBrowserError(resource, {
      attributes: [{ key: "exception.message", value: { stringValue: "connection reset" } }],
    });
    expect(error?.error.message).toBe("connection reset");
  });

  it("drops records with no service name", () => {
    expect(logRecordToBrowserError({}, record)).toBeNull();
  });

  it("drops records with no message", () => {
    expect(logRecordToBrowserError(resource, { severityText: "ERROR" })).toBeNull();
    expect(logRecordToBrowserError(resource, { body: { stringValue: "   " } })).toBeNull();
  });

  it("defaults the environment when the resource does not declare one", () => {
    const error = logRecordToBrowserError({ "service.name": "api-backend" }, record);
    expect(error?.environment).toBe("unknown");
  });

  it("truncates an oversized message instead of dropping the record", () => {
    const error = logRecordToBrowserError(resource, {
      body: { stringValue: "x".repeat(5_000) },
    });
    expect(error?.error.message).toHaveLength(2_000);
  });

  it("keeps a valid trace id and ignores a malformed span id", () => {
    const error = logRecordToBrowserError(resource, {
      ...record,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "nope",
    });
    expect(error?.trace).toEqual({ traceId: "4bf92f3577b34da6a3ce929d0e0e4736" });
  });

  it("ignores a malformed trace id entirely", () => {
    const error = logRecordToBrowserError(resource, { ...record, traceId: "short" });
    expect(error?.trace).toBeUndefined();
  });
});

describe("tag building", () => {
  it("excludes attributes that are already mapped onto the error", () => {
    expect(buildTags({
      "error.type": "ReportGenerationError",
      "exception.stacktrace": "Traceback...",
      "alert.domain": "record_failure",
    })).toEqual({ "alert.domain": "record_failure" });
  });

  it("caps the tag count and truncates long values", () => {
    const attributes: Record<string, string> = { long: "v".repeat(500) };
    for (let index = 0; index < 30; index += 1) attributes[`tag${index}`] = "value";
    const tags = buildTags(attributes) ?? {};
    expect(Object.keys(tags)).toHaveLength(20);
    expect(tags.long).toHaveLength(256);
  });

  it("drops keys that are too long and returns undefined when nothing is left", () => {
    expect(buildTags({ ["k".repeat(65)]: "value" })).toBeUndefined();
  });
});
