import { Navigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import type { PlatformOutletContext } from "../../app/platform-context";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const [searchParams] = useSearchParams();
  const { bootstrap } = useOutletContext<PlatformOutletContext>();
  if (section === "sources") return <Navigate replace to={`/${organizationId}/${projectId}/settings/integrations/telemetry`} />;
  if (section === "overview") {
    const legacyView = searchParams.get("view");
    const destination = legacyView === "productivity" || legacyView === "events" ? legacyView : "dashboard";
    return <Navigate replace to={`/${organizationId}/${projectId}/stats/${destination}`} />;
  }
  if (section !== "dashboard" && section !== "productivity" && section !== "events") {
    return <Navigate replace to={`/${organizationId}/${projectId}/stats/dashboard`} />;
  }

  return (
    <section className="cue-page stats-page">
      <StatsView organizationId={organizationId} projectId={projectId} view={section} canConfigure={bootstrap.actor.capabilities.includes("stats.configure")} />
    </section>
  );
}
