/**
 * Future authenticated attribution contract, not a public request DTO.
 * Only gateway credential resolution may construct a trusted subject; possession
 * of an ID or a structurally valid object provides no authority. Milestone 1
 * deliberately does not add this contract to live assertions or auth contexts.
 */
export type AuthenticatedSubject =
  | { kind: "human"; principalId: string }
  | { kind: "agent"; agentId: string }
  | { kind: "automation"; credentialId: string };

export type AgentProfileStatus = "disabled" | "active" | "archived";
export type AgentGrantStatus = "pending" | "active" | "revoked";

/** Fixed first-release ceiling; never interpret this as broad planning:write. */
export const AGENT_PROJECT_POLICY = "assigned_tasks_v1" as const;
export type AgentProjectPolicy = typeof AGENT_PROJECT_POLICY;

/** Correlation is separate from identity and never grants access. */
export interface AuthenticatedRequestAttribution {
  subject: AuthenticatedSubject;
  credentialId: string;
  requestId: string;
  orgId: number;
  projectId: string;
}
