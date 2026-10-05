import { describe, expect, it } from "vitest";
import {
  findForbiddenTransportPaths,
  parseTransportCommand,
  parseTransportReceipt,
  providerForOperation,
} from "../transport-commands";

const BASE = {
  contract: "platform.transport-command",
  version: 1,
  commandId: "command-1",
  idempotencyKey: "feedback:report-1:slack",
  causedByEventId: "550e8400-e29b-41d4-a716-446655440000",
  correlationId: "report-1",
  orgId: 7,
  projectId: "project-1",
  route: "feedback",
  requestedAt: "2026-10-04T10:16:00Z",
} as const;

describe("unified transport contracts", () => {
  it("accepts Slack and GitHub operations with the same envelope", () => {
    const slack = parseTransportCommand({
      ...BASE,
      operation: "slack.message.send",
      input: { message: { text: "New feedback", blocks: [] } },
    });
    const github = parseTransportCommand({
      ...BASE,
      commandId: "command-2",
      idempotencyKey: "feedback:report-1:github",
      operation: "github.issue.create",
      input: { issue: { title: "Checkout is broken", body: "Pay does not respond", labels: [] } },
    });
    expect(slack.projectId).toBe(github.projectId);
    expect(providerForOperation(slack.operation)).toBe("slack");
    expect(providerForOperation(github.operation)).toBe("github");
  });

  it("preserves Slack's idempotent client message identifier", () => {
    const command = parseTransportCommand({
      ...BASE,
      operation: "slack.message.send",
      input: { message: { text: "New feedback", client_msg_id: "capture-1", blocks: [] } },
    });

    expect(command.operation).toBe("slack.message.send");
    if (command.operation !== "slack.message.send") throw new Error("Expected Slack send command");
    expect(command.input.message.client_msg_id).toBe("capture-1");
  });

  it("rejects credentials and producer-resolved destinations", () => {
    const unsafe = {
      ...BASE,
      operation: "slack.message.send",
      input: { channelId: "C123", message: { text: "Unsafe", blocks: [] }, botToken: "secret" },
    };
    expect(findForbiddenTransportPaths(unsafe)).toEqual(["$.input.channelId", "$.input.botToken"]);
    expect(() => parseTransportCommand(unsafe)).toThrow("resolved provider destinations");
  });

  it("rejects a producer-selected GitHub repository", () => {
    expect(() => parseTransportCommand({
      ...BASE,
      operation: "github.issue.create",
      input: { repository: "another-repo", issue: { title: "Unsafe", body: "Body", labels: [] } },
    })).toThrow("resolved provider destinations");
  });

  it("rejects unknown operations and branded routes", () => {
    expect(() => parseTransportCommand({ ...BASE, operation: "email.send", input: {} })).toThrow();
    expect(() => parseTransportCommand({
      ...BASE,
      route: "noxspot",
      operation: "slack.message.send",
      input: { message: { text: "Message", blocks: [] } },
    })).toThrow();
  });

  it("requires results for delivery and errors for terminal failures", () => {
    const receipt = {
      contract: "platform.transport-receipt",
      version: 1,
      commandId: "command-1",
      idempotencyKey: "feedback:report-1:slack",
      operation: "slack.message.send",
      provider: "slack",
      status: "delivered",
      attempts: 1,
      recordedAt: "2026-10-04T10:16:01Z",
      result: { channelId: "C123", messageId: "123.456" },
    };
    expect(parseTransportReceipt(receipt).status).toBe("delivered");
    expect(() => parseTransportReceipt({ ...receipt, result: undefined })).toThrow("provider result");
    expect(() => parseTransportReceipt({ ...receipt, status: "failed", result: undefined })).toThrow("require an error");
  });
});
