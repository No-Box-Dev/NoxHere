import { Navigate, useOutletContext, useParams } from "react-router-dom";
import type { PlatformOutletContext } from "../../app/platform-context";
import { TeamDashboardView } from "./TeamDashboardView";

export default function DashboardPage() {
  const { organizationId = "", projectId = "", view = "overview" } = useParams();
  const { bootstrap, members, membersLoading, membersError } = useOutletContext<PlatformOutletContext>();

  if (view !== "overview") return <Navigate replace to={`/${organizationId}/${projectId}/dashboard/overview`} />;

  return <div className="workspace-view feed-view">
    <TeamDashboardView
      organizationId={organizationId}
      projectId={projectId}
      actorLogin={bootstrap.actor.id}
      members={members}
      membersLoading={membersLoading}
      membersError={membersError}
    />
  </div>;
}
