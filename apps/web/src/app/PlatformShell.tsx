import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { platformApi } from "../api/platform";
import { AsyncState } from "../components/AsyncState";
import { PlatformRetrieval } from "./PlatformRetrieval";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { serviceById, services, type ServiceId } from "./service-registry";
import { clearLastProject, saveLastProject } from "./last-project";

function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function PlatformShell() {
  const { organizationId = "", projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const bootstrap = useQuery({
    queryKey: ["platform", "bootstrap", organizationId, projectId],
    queryFn: ({ signal }) => platformApi.bootstrap(organizationId, projectId, signal),
    staleTime: 5 * 60_000,
  });
  const routeSegment = location.pathname.split("/").filter(Boolean)[2];
  const service = serviceById.get(routeSegment as ServiceId) ?? serviceById.get("connect")!;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => browserStorage()?.getItem("noxhere.sidebar.collapsed") === "true");
  const selectedProject = bootstrap.data?.projects.find((project) => project.id === projectId);
  const isGuest = bootstrap.data?.actor.accessLevel === "guest";
  const visibleServices = services.filter((item) => !item.hidden && (!isGuest || bootstrap.data?.actor.allowedServiceIds.includes(item.id)));
  const guestFallback = visibleServices[0];
  const guestRouteForbidden = Boolean(isGuest && routeSegment && (routeSegment === "settings" || !visibleServices.some((item) => item.id === routeSegment)));

  useEffect(() => {
    if (!bootstrap.data) return;
    if (selectedProject) {
      saveLastProject(bootstrap.data.actor.id, { organizationId: bootstrap.data.organization.id, projectId: selectedProject.id });
    } else {
      clearLastProject(bootstrap.data.actor.id, { organizationId, projectId });
    }
  }, [bootstrap.data, organizationId, projectId, selectedProject]);

  const toggleSidebar = () => setSidebarCollapsed((current) => {
    browserStorage()?.setItem("noxhere.sidebar.collapsed", String(!current));
    return !current;
  });

  const switchProject = (nextProject: string) => {
    const parts = location.pathname.split("/").filter(Boolean);
    parts[1] = nextProject;
    void navigate(`/${parts.join("/")}${location.search}`);
  };

  return (
    <AsyncState loading={bootstrap.isLoading} error={bootstrap.error}>
      {bootstrap.data ? (
        !selectedProject ? <Navigate replace to="/?choose=1" />
          : guestRouteForbidden && guestFallback ? <Navigate replace to={`/${bootstrap.data.organization.id}/${projectId}/${guestFallback.id}/${guestFallback.defaultView}`} />
          : <div className={`platform ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} style={{ "--service": service.color, "--service-soft": service.softColor } as CSSProperties}>
          <aside className="sidebar">
            <div className="brand-row">
              <Link className="platform-brand" to="/" aria-label="NoxHere home"><span>N</span><strong>NoxHere</strong></Link>
            </div>
            <button type="button" className="sidebar-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? "›" : "‹"}</button>
            <div className="sidebar-rule" />
            <span className="sidebar-label">Capabilities</span>
            <nav className="service-nav" aria-label="NoxConnect capabilities">
              {visibleServices.map((item) => <div className="service-nav-item" key={item.id}>
                {item.externalHref ? <a href={item.externalHref} target="_blank" rel="noreferrer" aria-label={item.name} title={sidebarCollapsed ? item.name : `${item.name} — opens App Store`}>
                  <ServiceIcon service={item} />
                  <span>{item.name}</span>
                </a> : <NavLink to={`/${bootstrap.data.organization.id}/${projectId}/${item.id}/${item.defaultView}`} className={({ isActive }) => isActive ? "active" : ""} aria-label={item.name} title={sidebarCollapsed ? item.name : undefined}>
                  <ServiceIcon service={item} />
                  <span>{item.name}</span>
                </NavLink>}
              </div>)}
            </nav>
            <div className="sidebar-account"><span>{bootstrap.data.actor.initials}</span><small>{bootstrap.data.organization.name}</small><b>⌄</b></div>
          </aside>
          <main className="main-canvas">
            <header className="platform-topbar">
              <PlatformRetrieval projectId={projectId} />
              <div className="topbar-actions">
              <ProjectSwitcher organizationId={bootstrap.data.organization.id} projects={bootstrap.data.projects} selectedId={projectId} canCreate={bootstrap.data.actor.isAdmin} placement="topbar" onSwitch={switchProject} />
              <a className="topbar-projects" href="/docs/" target="_blank" rel="noreferrer" aria-label="Open API documentation">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h9l3 3v13H6z" /><path d="M14 4v4h4M9 12h6M9 16h6" /></svg>
                <span>API docs</span>
              </a>
              {!isGuest ? <Link
                className="topbar-settings"
                to={`/${bootstrap.data.organization.id}/${projectId}/settings`}
                aria-label={`Open ${selectedProject?.name ?? "project"} settings`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
                  <path d="M19.1 13.2a7.7 7.7 0 0 0 .05-1.2 7.7 7.7 0 0 0-.05-1.2l2-1.55-2-3.46-2.47 1a9.2 9.2 0 0 0-2.08-1.2L14.2 3h-4l-.36 2.59c-.74.3-1.44.7-2.07 1.2l-2.48-1-2 3.46 2 1.55a7.7 7.7 0 0 0-.04 1.2c0 .4.01.8.05 1.2l-2 1.55 2 3.46 2.47-1c.63.5 1.33.9 2.07 1.2L10.2 21h4l.36-2.59c.74-.3 1.44-.7 2.08-1.2l2.47 1 2-3.46-2-1.55Z" />
                </svg>
                <span>Settings</span>
              </Link> : null}
              </div>
            </header>
            <div className="page-canvas">
              <Outlet context={{ bootstrap: bootstrap.data, service }} />
            </div>
          </main>
        </div>
      ) : null}
    </AsyncState>
  );
}

function ServiceIcon({ service }: { service: (typeof services)[number] }) {
  return <span className="service-icon" aria-hidden="true" style={{ "--icon-color": service.color, "--icon-soft": service.softColor } as CSSProperties}>
    <svg viewBox="0 0 24 24" fill="none">
      {service.id === "ticket" ? <><path d="M6 4v16M6 7h5a3 3 0 0 1 3 3v1a3 3 0 0 0 3 3h1" /><path d="m16 12 2 2 3-3" /></> : null}
      {service.id === "feed" ? <><path d="M6 7h12M6 12h12M6 17h8" /><circle cx="18" cy="17" r="1" /></> : null}
      {service.id === "spot" ? <><path d="M5 5.5h14v10H9l-4 3v-13Z" /><path d="M8 9h8M8 12h5" /></> : null}
      {service.id === "cue" ? <><path d="M5 19V9M10 19V5M15 19v-7M20 19V8" /><path d="m5 8 5-4 5 7 5-4" /></> : null}
      {service.id === "connect" ? <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="m8.5 11 7-3M8.5 13l7 3" /></> : null}
      {service.id === "key" ? <><circle cx="8" cy="12" r="3" /><path d="M11 12h9M17 12v3M20 12v2" /></> : null}
      {service.id === "mail" ? <><rect x="4" y="6" width="16" height="12" rx="2" /><path d="m5 8 7 5 7-5" /></> : null}
    </svg>
  </span>;
}
