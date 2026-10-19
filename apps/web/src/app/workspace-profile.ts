import { createContext, useContext } from "react";

export type WorkspaceProfile = {
  user: { login: string; email?: string | null };
  orgs: Array<{ login: string; role?: "guest" | "viewer" | "member" | "admin" | "owner" }>;
};

export const WorkspaceProfileContext = createContext<WorkspaceProfile | null>(null);

export function useWorkspaceProfile() {
  return useContext(WorkspaceProfileContext);
}
