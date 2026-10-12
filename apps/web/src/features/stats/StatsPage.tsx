import { Navigate, useParams } from "react-router-dom";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  if (section === "sources") return <Navigate replace to={`/${organizationId}/${projectId}/settings/integrations/telemetry`} />;

  return (
    <section className="cue-page stats-page">
      <StatsView organizationId={organizationId} projectId={projectId} />
    </section>
  );
}
