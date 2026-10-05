import { NavLink, useParams } from "react-router-dom";
import { AlertsView } from "./views/AlertsView";
import { StatsView } from "./views/StatsView";

export default function NoxCuePage() {
  const { organizationId = "no-box-dev", projectId = "playnist", section = "stats" } = useParams();
  const activeSection = section === "alerts" ? "alerts" : "stats";

  return (
    <section className="cue-page">
      <nav className="primary-tabs" aria-label="Incident views">
        <NavLink className={activeSection === "stats" ? "active" : ""} to={`/${organizationId}/${projectId}/cue/stats`}>Stats</NavLink>
        <NavLink className={activeSection === "alerts" ? "active" : ""} to={`/${organizationId}/${projectId}/cue/alerts`}>Alerts</NavLink>
      </nav>
      {activeSection === "stats" ? <StatsView organizationId={organizationId} projectId={projectId} /> : <AlertsView organizationId={organizationId} projectId={projectId} />}
    </section>
  );
}
