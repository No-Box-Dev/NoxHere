import type { Bootstrap, GithubMember } from "../api/contracts";

export type PlatformOutletContext = {
  bootstrap: Bootstrap;
  members: GithubMember[];
  membersLoading: boolean;
  membersError: Error | null;
  retryMembers: () => void;
};
