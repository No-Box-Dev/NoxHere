import { useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Bootstrap, Project } from "../api/contracts";
import { platformApi } from "../api/platform";
import { useWorkspaceProfile } from "./workspace-profile";

type ProjectSwitcherProps = {
  organizationId: string;
  organizationName: string;
  projects: Project[];
  selectedId: string;
  canCreate: boolean;
  placement?: "sidebar" | "topbar" | "brand";
  onSwitch: (organizationId: string, projectId: string) => void;
};

export function ProjectSwitcher({ organizationId, organizationName, projects, selectedId, canCreate, placement = "sidebar", onSwitch }: ProjectSwitcherProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const queryClient = useQueryClient();
  const profile = useWorkspaceProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRepositories, setDraftRepositories] = useState<string[] | null>(null);
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const otherOrganizations = useMemo(() => (profile?.orgs ?? [])
    .filter((organization) => organization.login.toLowerCase() !== organizationId.toLowerCase()), [organizationId, profile?.orgs]);
  const organizationQueries = useQueries({
    queries: otherOrganizations.map((organization) => ({
      queryKey: ["platform", "bootstrap", organization.login.toLowerCase(), ""],
      queryFn: ({ signal }: { signal: AbortSignal }) => platformApi.bootstrap(organization.login, "", signal),
      enabled: menuOpen,
      staleTime: 5 * 60_000,
    })),
  });
  const projectGroups = useMemo(() => [
    { organizationId, organizationName, projects, bootstrap: null as Bootstrap | null },
    ...otherOrganizations.map((organization, index) => ({
      organizationId: organization.login,
      organizationName: organization.login,
      projects: organizationQueries[index]?.data?.projects ?? [],
      bootstrap: organizationQueries[index]?.data ?? null,
    })),
  ].filter((group) => group.projects.length > 0), [organizationId, organizationName, organizationQueries, otherOrganizations, projects]);
  const routing = useQuery({
    queryKey: ["platform", "project-routing", organizationId, selectedId],
    queryFn: ({ signal }) => platformApi.projectRouting(organizationId, selectedId, signal),
    enabled: creating,
    staleTime: 60_000,
  });
  const availableRepositories = useMemo(() => {
    const owned = new Set((routing.data?.projects ?? []).filter((project) => project.enabled).flatMap((project) => project.repositories.map((repo) => repo.toLowerCase())));
    return (routing.data?.repositories ?? []).filter((repo) => !owned.has(repo.toLowerCase()));
  }, [routing.data]);
  const selectedRepositories = draftRepositories ?? availableRepositories;
  const create = useMutation({
    mutationFn: ({ name, repositories }: { name: string; repositories: string[] }) => platformApi.createProject(organizationId, name, repositories),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "bootstrap", organizationId] });
      setCreating(false);
      setDraftName("");
      setDraftRepositories(null);
      closeMenu();
      onSwitch(organizationId, project.id);
    },
  });

  const save = () => {
    const name = draftName.trim();
    if (name) create.mutate({ name, repositories: selectedRepositories });
  };
  const closeMenu = () => detailsRef.current?.removeAttribute("open");
  const switchProject = (nextOrganizationId: string, projectId: string, bootstrap: Bootstrap | null) => {
    if (bootstrap) queryClient.setQueryData(["platform", "bootstrap", nextOrganizationId.toLowerCase(), projectId], bootstrap);
    closeMenu();
    onSwitch(nextOrganizationId, projectId);
  };

  return (
    <details className={`project-switcher project-switcher-${placement}`} ref={detailsRef} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
      <summary aria-label="Open project switcher" role="button">
        {placement === "topbar" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9h-17z" /></svg> : null}
        <span>{placement === "topbar" ? "Projects" : selected?.name ?? "Choose project"}</span><b>⌄</b>
      </summary>
      <div className="project-menu">
        <div className="project-options">
          {projectGroups.map((group) => <section className="project-group" key={group.organizationId} aria-label={`${group.organizationName} projects`}>
            {projectGroups.length > 1 ? <h3>{group.organizationName}</h3> : null}
            {group.projects.map((project) => {
              const isSelected = group.organizationId.toLowerCase() === organizationId.toLowerCase() && project.id === selectedId;
              return <div className={`project-option ${isSelected ? "selected" : ""} ${project.environment === "test" ? "test-project" : ""}`} key={`${group.organizationId}/${project.id}`}>
                <button type="button" className="project-choice" onClick={() => switchProject(group.organizationId, project.id, group.bootstrap)}>
                  <span>{project.name}</span><i>{isSelected ? "✓" : ""}</i>
                </button>
              </div>;
            })}
          </section>)}
          {menuOpen && organizationQueries.some((query) => query.isLoading) ? <p className="project-menu-status" role="status">Loading other workspaces…</p> : null}
          {menuOpen && organizationQueries.length > 0 && organizationQueries.every((query) => query.isError) ? <p className="project-menu-status error" role="alert">Other workspaces could not be loaded.</p> : null}
        </div>
        <footer>
          <Link className="project-all-link" to="/?choose=1" aria-label="All workspaces and projects" onClick={closeMenu}>Switch workspace or project</Link>
          {canCreate && creating ? <form className="project-onboarding" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <label><span>Project name</span><input aria-label="New project name" maxLength={100} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Project name" autoFocus /></label>
            <fieldset><legend>Repositories <small>All available repositories are included by default.</small></legend>{routing.isLoading ? <p>Loading repositories…</p> : availableRepositories.length ? <div>{availableRepositories.map((repo) => <label key={repo}><input type="checkbox" checked={selectedRepositories.includes(repo)} onChange={() => setDraftRepositories((current) => { const selection = current ?? availableRepositories; return selection.includes(repo) ? selection.filter((item) => item !== repo) : [...selection, repo]; })} />{repo}</label>)}</div> : <p>No unassigned repositories. You can move repositories from another project in Project Settings.</p>}</fieldset>
            <div><button className="mini-button primary" disabled={create.isPending || !draftName.trim()}>{create.isPending ? "Creating…" : "Create project"}</button><button type="button" className="mini-button" onClick={() => { setCreating(false); setDraftName(""); setDraftRepositories(null); create.reset(); }}>Cancel</button></div>
          </form> : canCreate ? <button type="button" className="project-create" onClick={() => setCreating(true)}>+ New project</button> : null}
          {create.error ? <small role="alert">{create.error.message}</small> : null}
        </footer>
      </div>
    </details>
  );
}
