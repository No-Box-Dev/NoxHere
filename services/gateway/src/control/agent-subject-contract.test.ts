import { expectTypeOf, it } from "vitest";
import type { AuthenticatedRequestAttribution, AuthenticatedSubject } from "../../../../packages/contracts/agent-identities";

it("keeps persistent agent identity separate from rotating credentials and requests", () => {
  const subject = { kind: "agent", agentId: "agent-fixture" } satisfies AuthenticatedSubject;
  const attribution = {
    subject, credentialId: "credential-fixture", requestId: "request-fixture",
    orgId: 1, projectId: "project-fixture",
  } satisfies AuthenticatedRequestAttribution;
  expectTypeOf(attribution.subject.agentId).toEqualTypeOf<string>();
  expectTypeOf<Extract<AuthenticatedSubject, { kind: "human" }>>()
    .toEqualTypeOf<{ kind: "human"; principalId: string }>();
  expectTypeOf<Extract<AuthenticatedSubject, { kind: "automation" }>>()
    .toEqualTypeOf<{ kind: "automation"; credentialId: string }>();
  // These are compile-time contracts; none of these objects authenticates a caller.
  // @ts-expect-error An agent subject cannot be a run ID or credential alone.
  const invalid: AuthenticatedSubject = { kind: "agent", credentialId: "credential-fixture" };
  void invalid;
});
