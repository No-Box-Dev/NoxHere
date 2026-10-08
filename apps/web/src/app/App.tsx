import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthBoundary } from "./AuthBoundary";
import { PlatformShell } from "./PlatformShell";

const StatsPage = lazy(() => import("../features/stats/StatsPage"));
const IncidentsPage = lazy(() => import("../features/incidents/IncidentsPage"));
const NoxConnectPage = lazy(() => import("../features/connect/NoxConnectPage"));
const NoxTicketPage = lazy(() => import("../features/ticket/NoxTicketPage"));
const NoxFeedPage = lazy(() => import("../features/feed/NoxFeedPage"));
const NoxSpotPage = lazy(() => import("../features/spot/NoxSpotPage"));
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
            <Route path="incidents/:section" element={<IncidentsPage />} />
            <Route path="cue/:section" element={<LegacyCueRoute />} />
            <Route path="connect/:view" element={<NoxConnectPage />} />
            <Route path="ticket/:view" element={<NoxTicketPage />} />
            <Route path="feed/:view" element={<NoxFeedPage />} />
            <Route path="feed/:view/:person" element={<NoxFeedPage />} />
            <Route path="spot/:view" element={<NoxSpotPage />} />
            <Route path="key/:view" element={<NoxKeyPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to="connect/overview" />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>
    </AuthBoundary>
  );
}

function LegacyCueRoute() {
  const { organizationId = "", projectId = "", section = "stats" } = useParams();
  const location = useLocation();
  const destination = section === "alerts" ? "incidents/alerts" : section === "sources" ? "stats/sources" : "stats/overview";
  return <Navigate replace to={`/${organizationId}/${projectId}/${destination}${location.search}`} />;
}
