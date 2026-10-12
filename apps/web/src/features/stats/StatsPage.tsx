import { Navigate, useOutletContext, useParams } from "react-router-dom";
import type { PlatformOutletContext } from "../../app/platform-context";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const { bootstrap } = useOutletContext<PlatformOutletContext>();
  if (section === "sources") return <Navigate replace to={`/${organizationId}/${projectId}/settings/integrations/telemetry`} />;

  return (
    <section className="cue-page stats-page">
      <StatsView organizationId={organizationId} projectId={projectId} canConfigure={bootstrap.actor.capabilities.includes("stats.configure")} />
    </section>
  );
}
