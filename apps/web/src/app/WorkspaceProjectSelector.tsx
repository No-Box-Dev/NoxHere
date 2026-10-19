import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Bootstrap, Project } from "../api/contracts";
import { platformApi } from "../api/platform";
import { canAccessService, services } from "./service-registry";
import { readLastProject } from "./last-project";
import { Button } from "@/components/ui/button";
import { NoxLogo } from "@/components/ui/nox-logo";
import type { WorkspaceProfile } from "./workspace-profile";

export function WorkspaceProjectSelector({ profile, onRefresh }: { profile: WorkspaceProfile; onRefresh: () => Promise<WorkspaceProfile> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const workspaces = useMemo(() => {
    const personal = profile.user.login.toLowerCase();
    const lastWorkspace = readLastProject(profile.user.login)?.organizationId.toLowerCase();
    return profile.orgs.map((organization) => ({ ...organization, id: organization.login.toLowerCase() }))
      .sort((left, right) => {
        if (lastWorkspace && left.id === lastWorkspace) return -1;
        if (lastWorkspace && right.id === lastWorkspace) return 1;
        if (left.id === personal && right.id !== personal) return 1;
        if (right.id === personal && left.id !== personal) return -1;
        return left.login.localeCompare(right.login);
      });
  }, [profile.orgs, profile.user.login]);
  const bootstrapQueries = useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: ["platform", "bootstrap", workspace.id, ""],
      queryFn: ({ signal }: { signal: AbortSignal }) => platformApi.bootstrap(workspace.id, "", signal),
      staleTime: 5 * 60_000,
    })),
  });
  const effectiveWorkspace = workspaces.some((workspace) => workspace.id === selectedWorkspace) ? selectedWorkspace : workspaces[0]?.id ?? "";
  const workspaceIndex = workspaces.findIndex((workspace) => workspace.id === effectiveWorkspace);
  const workspace = workspaces[workspaceIndex];
  const workspaceQuery = bootstrapQueries[workspaceIndex];
  const bootstrap = workspaceQuery?.data;
  const projects = bootstrap?.projects ?? [];
  const effectiveProject = projects.some((project) => project.id === selectedProject) ? selectedProject : projects[0]?.id ?? "";
  const canCreate = workspace?.role === "admin" || workspace?.role === "owner" || Boolean(bootstrap?.actor.isAdmin);
  const allFailed = bootstrapQueries.length > 0 && bootstrapQueries.every((query) => query.isError);

  const create = useMutation({
    mutationFn: (name: string) => platformApi.createProject(effectiveWorkspace, name),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "bootstrap", effectiveWorkspace] });
      void navigate(`/${encodeURIComponent(effectiveWorkspace)}/${encodeURIComponent(project.id)}/connections/overview`);
    },
  });

  function chooseWorkspace(workspaceId: string) {
    setSelectedWorkspace(workspaceId);
    setSelectedProject("");
    setCreating(false);
    setProjectName("");
    create.reset();
  }

  function destination(currentBootstrap: Bootstrap, project: Project) {
    const guestService = services.find((service) => !service.hidden && canAccessService(service.id, currentBootstrap.actor.allowedServiceIds));
    const view = currentBootstrap.actor.accessLevel === "guest" && guestService
      ? `${guestService.id}/${guestService.defaultView}`
      : "connections/overview";
    queryClient.setQueryData(["platform", "bootstrap", effectiveWorkspace, project.id], currentBootstrap);
    void navigate(`/${encodeURIComponent(effectiveWorkspace)}/${encodeURIComponent(project.id)}/${view}`);
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (name) create.mutate(name);
  }

  async function refreshAccess() {
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const previous = new Set(profile.orgs.map((organization) => organization.login.toLowerCase()));
      const next = await onRefresh();
      const added = next.orgs.filter((organization) => !previous.has(organization.login.toLowerCase()));
      setRefreshMessage(added.length ? `Added ${added.map((organization) => organization.login).join(", ")}.` : "GitHub access is up to date.");
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "GitHub access could not be refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  return <main className="workspace-selector-page">
    <section className="workspace-selector-panel" aria-labelledby="workspace-selector-title">
      <header>
        <NoxLogo className="workspace-selector-logo" />
        <div><small>NoxHere</small><h1 id="workspace-selector-title">Choose a project</h1></div>
      </header>
      <label className="workspace-selector-field">
        <span>Workspace</span>
        <select aria-label="Workspace" value={effectiveWorkspace} onChange={(event) => chooseWorkspace(event.target.value)}>
          {workspaces.map((item) => <option value={item.id} key={item.id}>{item.login}</option>)}
        </select>
      </label>
      <div className="workspace-refresh">
        <Button variant="outline" type="button" disabled={refreshing} onClick={() => { void refreshAccess(); }}>{refreshing ? "Refreshing…" : "Refresh GitHub access"}</Button>
        {refreshMessage ? <small role="status">{refreshMessage}</small> : null}
      </div>

      {workspaceQuery?.isLoading ? <div className="workspace-selector-state" role="status"><span className="spinner" />Loading projects…</div> : null}
      {workspaceQuery?.isError ? <div className="workspace-selector-state error" role="alert">Could not load this workspace. Try another workspace or refresh.</div> : null}
      {allFailed ? <p className="workspace-selector-hint">None of your workspaces could be loaded.</p> : null}

      {!workspaceQuery?.isLoading && !workspaceQuery?.isError && projects.length ? <>
        <label className="workspace-selector-field">
          <span>Project</span>
          <select aria-label="Project" value={effectiveProject} onChange={(event) => setSelectedProject(event.target.value)}>
            {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
          </select>
        </label>
        <Button className="workspace-open" variant="cut" size="lg" type="button" onClick={() => {
          const project = projects.find((item) => item.id === effectiveProject);
          if (bootstrap && project) destination(bootstrap, project);
        }}>Open project</Button>
      </> : null}

      {!workspaceQuery?.isLoading && !workspaceQuery?.isError && !projects.length ? <div className="workspace-empty">
        <b>No projects yet</b>
        <p>Create the first project for {workspace?.login}. You can connect repositories and Slack after it opens.</p>
      </div> : null}

      {canCreate && (!projects.length || creating) ? <form className="workspace-project-form" onSubmit={submitProject}>
        <label className="workspace-selector-field"><span>Project name</span><input aria-label="New project name" value={projectName} maxLength={100} autoFocus={!projects.length} onChange={(event) => setProjectName(event.target.value)} placeholder="My project" /></label>
        <div><Button variant="cut" disabled={!projectName.trim() || create.isPending}>{create.isPending ? "Creating…" : "Create project"}</Button>{projects.length ? <Button variant="outline" type="button" onClick={() => { setCreating(false); setProjectName(""); create.reset(); }}>Cancel</Button> : null}</div>
        {create.error ? <small role="alert">{create.error.message}</small> : null}
      </form> : null}
      {canCreate && projects.length && !creating ? <button className="workspace-new-project" type="button" onClick={() => setCreating(true)}>+ Create another project</button> : null}
      {!workspaceQuery?.isLoading && !workspaceQuery?.isError && !projects.length && !canCreate ? <p className="workspace-selector-hint">Ask a workspace admin to create a project or add you to one.</p> : null}
    </section>
  </main>;
}
