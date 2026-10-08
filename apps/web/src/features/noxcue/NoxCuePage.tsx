import { NavLink, useOutletContext, useParams } from "react-router-dom";
import type { Bootstrap } from "../../api/contracts";
import { NoxCueSources } from "./NoxCueSources";
import { AlertsView } from "./views/AlertsView";
import { StatsView } from "./views/StatsView";

export default function NoxCuePage() {
  const { organizationId = "", projectId = "", section = "stats" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const activeSection = section === "alerts" || section === "sources" ? section : "stats";

  return (
    <section className="cue-page">
      <nav className="primary-tabs" aria-label="Incident views">
        <NavLink className={activeSection === "stats" ? "active" : ""} to={`/${organizationId}/${projectId}/cue/stats`}>Stats</NavLink>
        <NavLink className={activeSection === "alerts" ? "active" : ""} to={`/${organizationId}/${projectId}/cue/alerts`}>Alerts</NavLink>
        <NavLink className={activeSection === "sources" ? "active" : ""} to={`/${organizationId}/${projectId}/cue/sources`}>Sources</NavLink>
      </nav>
      {activeSection === "stats" ? <StatsView organizationId={organizationId} projectId={projectId} /> : activeSection === "alerts" ? <AlertsView organizationId={organizationId} projectId={projectId} /> : <NoxCueSources organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} />}
    </section>
  );
}
