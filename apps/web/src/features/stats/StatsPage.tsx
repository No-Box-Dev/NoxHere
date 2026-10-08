import { NavLink, useOutletContext, useParams } from "react-router-dom";
import type { Bootstrap } from "../../api/contracts";
import { StatsSources } from "./StatsSources";
import { StatsView } from "./StatsView";

export default function StatsPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const activeSection = section === "sources" ? "sources" : "overview";

  return (
    <section className="cue-page stats-page">
      <nav className="primary-tabs" aria-label="Stats views">
        <NavLink className={activeSection === "overview" ? "active" : ""} to={`/${organizationId}/${projectId}/stats/overview`}>Overview</NavLink>
        <NavLink className={activeSection === "sources" ? "active" : ""} to={`/${organizationId}/${projectId}/stats/sources`}>Sources</NavLink>
      </nav>
      {activeSection === "overview"
        ? <StatsView organizationId={organizationId} projectId={projectId} />
        : <StatsSources organizationId={organizationId} projectId={projectId} isAdmin={bootstrap.actor.isAdmin} />}
    </section>
  );
}
