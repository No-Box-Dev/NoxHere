import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthBoundary } from "./AuthBoundary";
import { PlatformShell } from "./PlatformShell";

const StatsPage = lazy(() => import("../features/stats/StatsPage"));
const IssuesAndIncidentsPage = lazy(() => import("../features/issues-incidents/IssuesAndIncidentsPage"));
const ConnectionsPage = lazy(() => import("../features/connections/ConnectionsPage"));
const PlanningPage = lazy(() => import("../features/planning/PlanningPage"));
const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const FeedbackPage = lazy(() => import("../features/feedback/FeedbackPage"));
const NoxKeyPage = lazy(() => import("../features/key/NoxKeyPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

export function App() {
  return (
    <AuthBoundary>
      <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/:organizationId/select/:service/:view" element={<Navigate replace to="/" />} />
          <Route path="/:organizationId/:projectId" element={<PlatformShell />}>
            <Route path="stats/:section" element={<StatsPage />} />
            <Route path="incidents/:section" element={<IssuesAndIncidentsPage />} />
            <Route path="connections/:view" element={<ConnectionsPage />} />
            <Route path="planning/:view" element={<PlanningPage />} />
            <Route path="activity/issues" element={<LegacyIssuesRoute />} />
            <Route path="feed/issues" element={<LegacyIssuesRoute />} />
            <Route path="activity/:view" element={<ActivityPage />} />
            <Route path="activity/:view/:person" element={<ActivityPage />} />
            <Route path="feedback/:view" element={<FeedbackPage />} />
            <Route path="key/:view" element={<NoxKeyPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="connect/:view" element={<LegacyCapabilityRoute capability="connections" />} />
            <Route path="ticket/:view" element={<LegacyCapabilityRoute capability="planning" />} />
            <Route path="feed/:view" element={<LegacyCapabilityRoute capability="activity" />} />
            <Route path="feed/:view/:person" element={<LegacyCapabilityRoute capability="activity" />} />
            <Route path="spot/:view" element={<LegacyCapabilityRoute capability="feedback" />} />
            <Route path="telemetry/:view" element={<LegacyTelemetryRoute />} />
            <Route path="*" element={<ProjectFallback />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </AuthBoundary>
  );
}

function LegacyIssuesRoute() {
  const { organizationId = "", projectId = "" } = useParams();
  return <Navigate replace to={`/${organizationId}/${projectId}/incidents/issues`} />;
}

function LegacyCapabilityRoute({ capability }: { capability: "connections" | "planning" | "activity" | "feedback" }) {
  const { organizationId = "", projectId = "", view = "", person } = useParams();
  const suffix = person ? `/${encodeURIComponent(person)}` : "";
  return <Navigate replace to={`/${organizationId}/${projectId}/${capability}/${view}${suffix}`} />;
}

function LegacyTelemetryRoute() {
  const { organizationId = "", projectId = "", view = "stats" } = useParams();
  const destination = view === "alerts" ? "incidents/alerts" : view === "sources" ? "stats/sources" : "stats/overview";
  return <Navigate replace to={`/${organizationId}/${projectId}/${destination}`} />;
}

function ProjectFallback() {
  const { organizationId = "", projectId = "" } = useParams();
  return <Navigate replace to={`/${organizationId}/${projectId}/connections/overview`} />;
}
