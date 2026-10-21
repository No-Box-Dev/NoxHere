import { Navigate, useOutletContext, useParams } from "react-router-dom";
import type { PlatformOutletContext } from "../../app/platform-context";
import { GrowthView } from "./GrowthView";

export default function GrowthPage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const { bootstrap } = useOutletContext<PlatformOutletContext>();
  if (section !== "overview" && section !== "funnel" && section !== "acquisition" && section !== "events") {
    return <Navigate replace to={`/${organizationId}/${projectId}/growth/overview`} />;
  }
  return <section className="cue-page growth-page"><GrowthView organizationId={organizationId} projectId={projectId} actorId={bootstrap.actor.id} view={section} /></section>;
}
