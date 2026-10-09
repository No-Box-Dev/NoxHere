import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "../api/platform";
import { StatusTag } from "./StatusTag";

const projectRoutingKey = (organizationId: string) => ["platform", "project-routing", organizationId] as const;

export function ProjectRepositories({ organizationId, projectId, projectName, canManage, connectedRepositories }: { organizationId: string; projectId: string; projectName: string; canManage: boolean; connectedRepositories: string[] }) {
  const queryClient = useQueryClient();
  const routing = useQuery({
    queryKey: projectRoutingKey(organizationId),
    queryFn: ({ signal }) => platformApi.projectRouting(organizationId, signal),
    enabled: canManage,
    staleTime: 60_000,
  });
  const project = routing.data?.projects.find((item) => item.id === projectId);
  const [draft, setDraft] = useState<{ projectId: string; repositories: string[] } | null>(null);
  const [search, setSearch] = useState("");
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const owners = useMemo(() => new Map((routing.data?.projects ?? []).filter((item) => item.enabled && item.id !== projectId).flatMap((item) => item.repositories.map((repo) => [repo.toLowerCase(), item.name] as const))), [projectId, routing.data?.projects]);
  const repositories = routing.data?.repositories ?? connectedRepositories;
  const original = project?.repositories ?? connectedRepositories;
  const selected = draft?.projectId === projectId ? draft.repositories : original;
  const selectedNames = useMemo(() => new Set(selected.map((repo) => repo.toLowerCase())), [selected]);
  const filtered = repositories.filter((repo) => repo.toLowerCase().includes(search.trim().toLowerCase()));
  const dirty = [...selected].sort().join("\n") !== [...original].sort().join("\n");
  const save = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Project repository settings are unavailable.");
      await platformApi.setProjectRouting(organizationId, { ...project, enabled: true, repositories: selected });
    },
    onSuccess: async () => {
      setSavedProjectId(projectId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectRoutingKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: ["platform", "bootstrap", organizationId] }),
      ]);
    },
  });

  if (!canManage) return <RepositoryList repositories={connectedRepositories} projectName={projectName} />;
  if (routing.isLoading) return <div className="connect-empty"><b>Loading project repositories</b><p>Reading the central repository map…</p></div>;
  if (routing.isError || !project) return <div className="connect-empty"><b>Repository settings could not be loaded</b><p>{routing.error instanceof Error ? routing.error.message : !project ? `${projectName} is missing from the repository map.` : "The existing project mapping has not been changed."}</p><button type="button" className="mini-button" disabled={routing.isFetching} onClick={() => void routing.refetch()}>{routing.isFetching ? "Retrying…" : "Retry"}</button></div>;

  const toggle = (repo: string) => {
    setSavedProjectId(null);
    setDraft({ projectId, repositories: selected.some((item) => item.toLowerCase() === repo.toLowerCase())
      ? selected.filter((item) => item.toLowerCase() !== repo.toLowerCase())
      : [...selected, repo] });
  };
  return <div className="project-repository-editor">
    <div className="connect-inline-action"><p>These repositories define <b>{projectName}</b> everywhere in Nox—Planning, Activity, Feedback, Incidents, API access, and Slack routing.</p><StatusTag tone="positive">Platform-wide</StatusTag></div>
    <div className="repository-editor-toolbar">
      <input type="search" aria-label="Search repositories" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories…" />
      <button type="button" className="mini-button" onClick={() => { setDraft({ projectId, repositories }); setSavedProjectId(null); }}>Select all</button>
      <button type="button" className="mini-button" onClick={() => { setDraft({ projectId, repositories: [] }); setSavedProjectId(null); }}>Clear</button>
    </div>
    <div className="repository-checklist">
      {filtered.map((repo) => {
        const checked = selectedNames.has(repo.toLowerCase());
        const owner = owners.get(repo.toLowerCase());
        return <label className={checked ? "selected" : ""} key={repo}><input type="checkbox" checked={checked} onChange={() => toggle(repo)} /><span><b>{repo}</b><small>{owner && !checked ? `Currently in ${owner} · selecting moves it here` : checked ? `Included in ${projectName}` : "Available"}</small></span></label>;
      })}
    </div>
    <div className="repository-editor-footer"><span>{selected.length} of {repositories.length} repositories selected</span><div>{savedProjectId === projectId && !dirty ? <span className="form-success" role="status">Saved</span> : null}<button type="button" className="button primary-button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save repositories"}</button></div></div>
    {save.isError ? <p className="form-error" role="alert">{save.error instanceof Error ? save.error.message : "Repositories could not be saved."}</p> : null}
  </div>;
}

function RepositoryList({ repositories, projectName }: { repositories: string[]; projectName: string }) {
  if (!repositories.length) return <div className="connect-empty"><b>No connected repositories</b><p>An administrator can add repositories to {projectName} in Project Settings.</p></div>;
  return <div className="list-surface">{repositories.map((repository) => <div className="list-row" key={repository}><span className="list-symbol">R</span><span className="list-copy"><b>{repository}</b><small>Included across every {projectName} capability</small></span><span className="list-meta"><StatusTag tone="positive">Included</StatusTag></span></div>)}</div>;
}
