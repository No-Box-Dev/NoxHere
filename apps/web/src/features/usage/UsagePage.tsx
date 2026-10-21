import { Navigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import type { PlatformOutletContext } from "../../app/platform-context";
import { UsageView } from "./UsageView";

export default function UsagePage() {
  const { organizationId = "", projectId = "", section = "overview" } = useParams();
  const [searchParams] = useSearchParams();
  const { bootstrap } = useOutletContext<PlatformOutletContext>();
  if (section === "sources") return <Navigate replace to={`/${organizationId}/${projectId}/settings/integrations/usage`} />;
  if (section === "dashboard") {
    const legacyView = searchParams.get("view");
    const destination = legacyView === "events" ? "events" : "overview";
    return <Navigate replace to={`/${organizationId}/${projectId}/usage/${destination}`} />;
  }
  if (section !== "overview" && section !== "engagement" && section !== "events") {
    return <Navigate replace to={`/${organizationId}/${projectId}/usage/overview`} />;
  }

  return (
    <section className="cue-page usage-page">
      <UsageView organizationId={organizationId} projectId={projectId} actorId={bootstrap.actor.id} view={section} canConfigure={bootstrap.actor.capabilities.includes("usage.configure")} />
    </section>
  );
}
