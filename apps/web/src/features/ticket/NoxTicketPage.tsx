import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import type { Bootstrap, PlanningTask, TicketFeatureAttachment, TicketFeatureRecord } from "../../api/contracts";
import { platformApi, projectSettingsQueryKey } from "../../api/platform";
import { postRawJson } from "../../api/http";
import { ListRow } from "../../components/ListRow";
import { useConfirmDialog } from "../../components/ConfirmDialog";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ServiceTabs } from "../../components/ServiceTabs";
import { StatusTag } from "../../components/StatusTag";

const tabs = [["board", "Features"], ["tasks", "Tasks"], ["backlog", "Backlog"], ["completed", "Completed"], ["settings", "Settings"]] as const;

type Stage = { id: string; label: string; color: string };
type FeatureLink = { url: string; label?: string };
type Priority = 1 | 2 | 3 | 4 | 5;
type TicketFeature = { id: number; title: string; status: string; owners: string[]; description: string; links: FeatureLink[]; backlog: boolean; priority: Priority; closed: boolean; updated: string; history: string[] };
type TicketFeaturePatch = { title?: string; status?: string; owners?: string[]; description?: string; links?: FeatureLink[]; backlog?: boolean; priority?: number; state?: "open" | "closed" };
type FeatureView = "board" | "backlog" | "completed";
type TaskInput = { title: string; note?: string; owner?: string; featureNumber?: number | null; stageId?: string };

export default function NoxTicketPage() {
  const { organizationId = "", projectId = "", view = "board" } = useParams();
  const { bootstrap } = useOutletContext<{ bootstrap: Bootstrap }>();
  const [searchParams] = useSearchParams();
  const project = bootstrap.projects.find((item) => item.id === projectId);
  const isGuest = bootstrap.actor.accessLevel === "guest";
  const members = project?.members.map((member) => member.login) ?? [];
  const base = `/${organizationId}/${projectId}/ticket`;
  const [stages, setStages] = useState<Stage[]>(productionStages);
  const [taskStages, setTaskStages] = useState<Stage[]>(defaultTaskStages);
  const [features, setFeatures] = useState<TicketFeature[]>([]);
  const nextOptimisticFeatureId = useRef(-1);
  const queryClient = useQueryClient();
  const settingsKey = projectSettingsQueryKey(organizationId, projectId);
  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => platformApi.projectSettings(organizationId, projectId, signal),
  });
  const featureQuery = useQuery({
    queryKey: ["ticket", organizationId, projectId, "features"],
    queryFn: ({ signal }) => platformApi.ticketFeatures(organizationId, projectId, signal),
    enabled: view !== "settings",
  });
  const tasksKey = ["ticket", organizationId, projectId, "tasks"] as const;
  const taskQuery = useQuery({ queryKey: tasksKey, queryFn: ({ signal }) => platformApi.planningTasks(organizationId, projectId, signal), enabled: view !== "settings" });
  const createTaskMutation = useMutation({
    mutationFn: (input: TaskInput) => platformApi.createPlanningTask(organizationId, projectId, input),
    onSuccess: (task) => queryClient.setQueryData<PlanningTask[]>(tasksKey, (current = []) => [...current.filter((item) => item.id !== task.id), task]),
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<PlanningTask, "title" | "note" | "owner" | "status" | "featureNumber" | "stageId" | "position">> }) => platformApi.updatePlanningTask(organizationId, projectId, id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: tasksKey });
      const previous = queryClient.getQueryData<PlanningTask[]>(tasksKey) ?? [];
      queryClient.setQueryData<PlanningTask[]>(tasksKey, previous.map((task) => task.id === id ? { ...task, ...patch } : task));
      return { previous };
    },
    onSuccess: (task) => queryClient.setQueryData<PlanningTask[]>(tasksKey, (current = []) => current.map((item) => item.id === task.id ? task : item)),
    onError: (_error, _variables, context) => queryClient.setQueryData(tasksKey, context?.previous ?? []),
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => platformApi.deletePlanningTask(organizationId, projectId, id),
    onSuccess: (_result, id) => queryClient.setQueryData<PlanningTask[]>(tasksKey, (current = []) => current.filter((item) => item.id !== id)),
  });
  const featureReady = !featureQuery.isLoading && !featureQuery.isError && !taskQuery.isLoading && !taskQuery.isError && !settingsQuery.isLoading && !settingsQuery.isError;
  /* Query results become an editable local board snapshot. Project changes must replace that snapshot. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (featureQuery.data) {
      setFeatures(featureQuery.data.map(mapFeature));
    }
  }, [featureQuery.data, projectId]);
  useEffect(() => {
    setStages(settingsQuery.data?.boardStages?.length ? settingsQuery.data.boardStages : productionStages);
    setTaskStages(settingsQuery.data?.taskBoardStages?.length ? settingsQuery.data.taskBoardStages : defaultTaskStages);
  }, [projectId, settingsQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const saveStages = useMutation({
    mutationFn: ({ next }: { next: Stage[]; previous: Stage[] }) => platformApi.setProjectSettings(organizationId, projectId, { ...(settingsQuery.data ?? {}), boardStages: next }),
    onSuccess: (settings) => queryClient.setQueryData(settingsKey, settings),
    onError: (_error, { previous }) => setStages(previous),
  });
  const persistStages = (next: Stage[]) => {
    const previous = stages;
    setStages(next);
    saveStages.mutate({ next, previous });
  };
  const saveTaskStages = useMutation({
    mutationFn: ({ next }: { next: Stage[]; previous: Stage[] }) => platformApi.setProjectSettings(organizationId, projectId, { ...(settingsQuery.data ?? {}), taskBoardStages: next }),
    onSuccess: (settings) => queryClient.setQueryData(settingsKey, settings),
    onError: (_error, { previous }) => setTaskStages(previous),
  });
  const persistTaskStages = (next: Stage[]) => {
    const previous = taskStages;
    setTaskStages(next);
    saveTaskStages.mutate({ next, previous });
  };
  const updateFeature = useMutation({
    mutationFn: ({ next, patch }: { next: TicketFeature; previous: TicketFeature; patch: TicketFeaturePatch }) => platformApi.updateTicketFeature(organizationId, projectId, next.id, patch),
    onSuccess: (record) => setFeatures((current) => current.map((feature) => feature.id === record.number ? mapFeature(record) : feature)),
    onError: (_error, { previous }) => setFeatures((current) => current.map((feature) => feature.id === previous.id ? previous : feature)),
  });
  const createFeatureMutation = useMutation({
    mutationFn: ({ title, backlog, status, owner }: { title: string; backlog: boolean; status: string; owner: string; optimisticId: number }) => platformApi.createTicketFeature(organizationId, projectId, { title, backlog, status, owners: [owner] }),
    onSuccess: (record, { optimisticId }) => {
      const feature = mapFeature(record);
      setFeatures((current) => current.filter((item) => item.id !== feature.id).map((item) => item.id === optimisticId ? feature : item));
    },
    onError: (_error, { optimisticId }) => setFeatures((current) => current.filter((feature) => feature.id !== optimisticId)),
  });
  const createFeature = (title: string, backlog: boolean, owner: string) => {
    const optimisticId = nextOptimisticFeatureId.current--;
    const status = stages[0]?.id ?? "todo";
    setFeatures((current) => [...current, {
      id: optimisticId,
      title,
      status,
      owners: [owner],
      description: "",
      links: [],
      backlog,
      priority: 3,
      closed: false,
      updated: "Now",
      history: ["Created · now"],
    }]);
    createFeatureMutation.mutate({ title, backlog, status, owner, optimisticId });
  };
  const deleteFeatureMutation = useMutation({
    mutationFn: (feature: TicketFeature) => platformApi.deleteTicketFeature(organizationId, projectId, feature.id),
    onError: (_error, feature) => setFeatures((current) => current.some((item) => item.id === feature.id) ? current : [...current, feature]),
  });
  const saveFeature = (next: TicketFeature) => {
    const previous = features.find((feature) => feature.id === next.id);
    setFeatures((current) => current.map((feature) => feature.id === next.id ? next : feature));
    if (previous) {
      const patch = changedFeatureFields(previous, next);
      if (Object.keys(patch).length > 0) updateFeature.mutate({ next, previous, patch });
    }
  };
  const deleteFeature = (feature: TicketFeature) => {
    setFeatures((current) => current.filter((item) => item.id !== feature.id));
    deleteFeatureMutation.mutate(feature);
  };

  const legacyView = searchParams.get("view");
  if ((view === "board" || view === "features") && (legacyView === "backlog" || legacyView === "completed")) {
    return <Navigate replace to={`${base}/${legacyView}`} />;
  }
  if (view === "activity" || view === "specs" || view === "features" || (isGuest && view === "settings")) return <Navigate replace to={`${base}/board`} />;
  const visibleTabs = isGuest ? tabs.filter(([id]) => id !== "settings") : tabs;
  return <section>
    <ServiceTabs base={base} active={view} tabs={visibleTabs} />
    <div className="workspace-view ticket-workspace">
      {(view !== "settings" && (featureQuery.isLoading || taskQuery.isLoading)) || settingsQuery.isLoading ? <DataNotice title="Loading planning" detail="Reading this project's planning data…" /> : null}
      {(view !== "settings" && (featureQuery.isError || taskQuery.isError)) || settingsQuery.isError ? <DataNotice title="Planning is unavailable" detail="The dashboard could not reach the planning API. No placeholder tickets are being shown." /> : null}
      {featureReady && view === "tasks" ? <TasksBoard key={projectId} organizationId={organizationId} projectId={projectId} stages={taskStages} features={features} tasks={taskQuery.data ?? []} actor={bootstrap.actor.id} members={members} createTask={(input) => createTaskMutation.mutate(input)} updateTask={(id, patch) => updateTaskMutation.mutate({ id, patch })} deleteTask={(id) => deleteTaskMutation.mutate(id)} saving={createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending} /> : null}
      {featureReady && (view === "board" || view === "backlog" || view === "completed") ? <FeaturesWorkspace key={projectId} organizationId={organizationId} projectId={projectId} mode={view} stages={stages} features={features} actor={bootstrap.actor.id} members={members} createFeature={createFeature} saveFeature={saveFeature} deleteFeature={deleteFeature} saving={updateFeature.isPending || createFeatureMutation.isPending} /> : null}
      {view === "settings" && !settingsQuery.isLoading && !settingsQuery.isError ? <TicketSettings organizationId={organizationId} projectId={projectId} repository={project?.connections.find((connection) => connection.provider === "github")?.label ?? null} stages={stages} setStages={setStages} saveStages={persistStages} savingStages={saveStages.isPending} stageSaveError={saveStages.error} taskStages={taskStages} setTaskStages={setTaskStages} saveTaskStages={persistTaskStages} savingTaskStages={saveTaskStages.isPending} taskStageSaveError={saveTaskStages.error} /> : null}
    </div>
  </section>;
}

const productionStages: Stage[] = [
  { id: "todo", label: "To do", color: "#94a3b8" },
  { id: "specced", label: "Specced", color: "#8b83b8" },
  { id: "staging", label: "Testing on staging", color: "#b89464" },
  { id: "ready", label: "Ready for production", color: "#6a9991" },
  { id: "production", label: "On production", color: "#6e9970" },
];

const defaultTaskStages: Stage[] = [
  { id: "todo", label: "To do", color: "#94a3b8" },
  { id: "in-progress", label: "In progress", color: "#8b83b8" },
  { id: "blocked", label: "Blocked", color: "#c77b63" },
  { id: "done", label: "Completed", color: "#6e9970" },
];

function mapFeature(record: TicketFeatureRecord): TicketFeature {
  const labels = record.labels.map((label) => typeof label === "string" ? label : label.name);
  const status = record.status ?? labels.find((label) => label.startsWith("status:"))?.slice(7) ?? "todo";
  let description = record.description ?? record.plan ?? record.body ?? "";
  let history: string[] = (record.statusHistory ?? []).slice().reverse().map((item) => `Moved to ${item.status ?? "stage"} · ${formatDate(item.at ?? item.timestamp)}`);
  const metadata = description.match(/\n?<!-- noxticket:metadata\n([\s\S]*?)\n-->\s*$/);
  if (metadata) {
    description = description.slice(0, metadata.index).trim();
    try {
      const parsed = JSON.parse(metadata[1]) as { statusHistory?: Array<{ status?: string; timestamp?: string }> };
      if (history.length === 0) history = (parsed.statusHistory ?? []).slice().reverse().map((item) => `Moved to ${item.status ?? "stage"} · ${formatDate(item.timestamp)}`);
    } catch { history = []; }
  }
  return {
    id: record.number,
    title: record.title,
    status,
    owners: record.owners ?? record.assignees.map((owner) => owner.login),
    description,
    links: record.links ?? record.specLinks ?? [],
    backlog: record.backlog ?? labels.includes("backlog"),
    priority: (record.priority ?? 3) as Priority,
    closed: record.state === "closed",
    updated: formatDate(record.updatedAt ?? record.updated_at),
    history,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed);
}

function DataNotice({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-view data-notice" role="status"><h2>{title}</h2><p>{detail}</p></div>;
}

function FeaturesWorkspace({ organizationId, projectId, mode, stages, features, actor, members, createFeature, saveFeature, deleteFeature, saving }: { organizationId: string; projectId: string; mode: FeatureView; stages: Stage[]; features: TicketFeature[]; actor: string; members: string[]; createFeature: (title: string, backlog: boolean, owner: string) => void; saveFeature: (feature: TicketFeature) => void; deleteFeature: (feature: TicketFeature) => void; saving: boolean }) {
  const { confirm, confirmation } = useConfirmDialog();
  const [queries, setQueries] = useState<Record<FeatureView, string>>(() => ({ board: "", backlog: "", completed: "" }));
  const query = queries[mode];
  const people = members.includes(actor) ? members : [actor, ...members];
  const [person, setPerson] = useState(actor);
  const [sort, setSort] = useState<"updated" | "title">("updated");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = features.find((feature) => feature.id === selectedId) ?? null;
  const normalizedPerson = person.toLowerCase();
  const active = useMemo(() => features.filter((feature) => !feature.closed && !feature.backlog && featureOwnedBy(feature, normalizedPerson) && matches(feature, query, "")).sort(sort === "title" ? byTitle : () => 0), [features, normalizedPerson, query, sort]);
  const backlog = useMemo(() => features.filter((feature) => !feature.closed && feature.backlog && featureOwnedBy(feature, normalizedPerson) && matches(feature, query, "")).sort(byTitle), [features, normalizedPerson, query]);
  const completed = useMemo(() => features.filter((feature) => feature.closed && featureOwnedBy(feature, normalizedPerson) && matches(feature, query, "")), [features, normalizedPerson, query]);
  const addFeature = (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    createFeature(title, mode === "backlog", person);
    setNewTitle(""); setAdding(false);
  };
  const moveFeature = (id: number, status: string) => { const feature = features.find((item) => item.id === id); if (feature) saveFeature({ ...feature, status, updated: "Now", history: [`Moved to ${stages.find((stage) => stage.id === status)?.label ?? status} · now`, ...feature.history] }); };
  const drop = (event: DragEvent, status: string) => { event.preventDefault(); const id = Number(event.dataTransfer.getData("text/plain")); if (Number.isFinite(id)) moveFeature(id, status); };
  const productionStage = stages.at(-1)?.id;
  const productionCount = active.filter((feature) => feature.status === productionStage).length;
  const completeProduction = () => {
    if (!productionStage) return;
    active.filter((feature) => feature.status === productionStage).forEach((feature) => {
      saveFeature({ ...feature, closed: true, updated: "Now", history: ["Completed · now", ...feature.history] });
    });
  };

  return <>
    <div className="ticket-toolbar">
      <input aria-label={`Search ${mode === "board" ? "features" : mode}`} value={query} onChange={(event) => setQueries((current) => ({ ...current, [mode]: event.target.value }))} placeholder={`Search ${mode === "board" ? "features" : mode}…`} />
      <label className="planning-person-picker"><span>Planning for</span><SearchableSelect ariaLabel="Planning for person" value={person} onChange={setPerson} options={people.map((member) => ({ value: member, label: member === actor ? `${member} (you)` : member }))} /></label>
      <select aria-label="Sort features" value={sort} onChange={(event) => setSort(event.target.value as "updated" | "title")}><option value="updated">Default</option><option value="title">Title A–Z</option></select>
      <span className="toolbar-spacer" />{mode === "board" ? <button type="button" className="button" disabled={productionCount === 0 || saving} onClick={completeProduction}>{saving ? "Moving…" : `Move production to completed${productionCount ? ` (${productionCount})` : ""}`}</button> : null}<button type="button" className="button primary-button" onClick={() => setAdding(true)}>New feature</button>
    </div>
    <PlanningAiBar organizationId={organizationId} projectId={projectId} kind="feature" owner={person} features={features} onApply={(draft) => createFeature(draft.title, mode === "backlog", person)} />
    {adding ? <form className="ticket-create-row" onSubmit={addFeature}><input autoFocus aria-label="Feature title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={mode === "backlog" ? "Add to backlog…" : "Feature title…"} /><button className="button primary-button">Create feature</button><button type="button" className="button" onClick={() => setAdding(false)}>Cancel</button></form> : null}
    {mode === "board" ? <div className="ticket-board full-board">{stages.map((stage) => { const items = active.filter((feature) => feature.status === stage.id); return <section className="ticket-column" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.id)}><header><span className="stage-title"><i style={{ background: stage.color }} /><b>{stage.label}</b></span><span>{items.length}</span></header>{items.map((feature) => <div draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", String(feature.id)); event.dataTransfer.effectAllowed = "move"; }} key={feature.id}><FeatureCard organizationId={organizationId} projectId={projectId} feature={feature} members={members} onOpen={() => setSelectedId(feature.id)} onPriority={(priority) => saveFeature({ ...feature, priority, updated: "Now" })} onAssign={(owner) => saveFeature({ ...feature, owners: owner ? [owner] : [], updated: "Now" })} onMoveToBacklog={() => saveFeature({ ...feature, backlog: true, updated: "Now", history: ["Moved to Backlog · now", ...feature.history] })} onDelete={() => deleteFeature(feature)} /></div>)}<button type="button" className="ticket-add" onClick={() => setAdding(true)}>＋ Add feature</button></section>; })}</div> : null}
    {mode === "backlog" ? <div className="ticket-list">{backlog.map((feature) => <div className="list-row ticket-backlog-row" key={feature.id}><PriorityFlag feature={feature} onChange={(priority) => saveFeature({ ...feature, priority, updated: "Now" })} /><button type="button" className="list-copy row-open-button" onClick={() => setSelectedId(feature.id)}><b>{feature.title}</b><small>#{feature.id} · {feature.links.length} {feature.links.length === 1 ? "link" : "links"} · {feature.owners.join(", ") || "Unassigned"}</small></button><span className="list-meta"><AttachmentUploadButton organizationId={organizationId} projectId={projectId} feature={feature} /><button className="mini-button" onClick={() => saveFeature({ ...feature, backlog: false, updated: "Now", history: ["Moved to Features · now", ...feature.history] })}>Move to features</button><button type="button" className="ticket-card-action destructive" aria-label={`Delete ${feature.title}`} title="Delete" onClick={() => void confirm({ title: "Delete feature?", detail: `“${feature.title}” will be removed from planning.`, confirmLabel: "Delete feature", destructive: true }).then((confirmed) => { if (confirmed) deleteFeature(feature); })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg></button></span></div>)}</div> : null}
    {mode === "completed" ? <div className="ticket-list">{completed.map((feature) => <div className="list-row ticket-priority-row" key={feature.id}><PriorityFlag feature={feature} onChange={(priority) => saveFeature({ ...feature, priority, updated: "Now" })} /><button type="button" className="list-copy row-open-button" onClick={() => setSelectedId(feature.id)}><b>{feature.title}</b><small>#{feature.id} · completed {feature.updated} · {feature.owners.join(", ") || "Unassigned"}</small></button><span className="list-meta"><AttachmentUploadButton organizationId={organizationId} projectId={projectId} feature={feature} /><button className="mini-button" onClick={() => saveFeature({ ...feature, closed: false, status: stages.at(-1)?.id ?? "done", updated: "Now", history: ["Restored · now", ...feature.history] })}>Restore</button></span></div>)}</div> : null}
    {((mode === "backlog" && backlog.length === 0) || (mode === "completed" && completed.length === 0)) ? <div className="empty-view"><h2>Nothing here yet</h2><p>{mode === "backlog" ? "Send a feature to the backlog when you want to park it." : "Completed features appear here after they are cleaned from the final stage."}</p></div> : null}
    {selected ? <FeatureDialog organizationId={organizationId} projectId={projectId} feature={selected} stages={stages} members={members} onClose={() => setSelectedId(null)} onSave={(next) => { saveFeature(next); setSelectedId(null); }} /> : null}
    {confirmation}
  </>;
}

function TasksBoard({ organizationId, projectId, stages, features, tasks, actor, members, createTask, updateTask, deleteTask, saving }: { organizationId: string; projectId: string; stages: Stage[]; features: TicketFeature[]; tasks: PlanningTask[]; actor: string; members: string[]; createTask: (input: TaskInput) => void; updateTask: (id: string, patch: Partial<Pick<PlanningTask, "status" | "stageId" | "position">>) => void; deleteTask: (id: string) => void; saving: boolean }) {
  const people = members.includes(actor) ? members : [actor, ...members];
  const [person, setPerson] = useState(actor);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const featureByNumber = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);
  const visibleTasks = useMemo(() => tasks
    .filter((task) => task.owner.toLowerCase() === person.toLowerCase() && (!normalizedQuery || `${task.title} ${task.note}`.toLowerCase().includes(normalizedQuery)))
    .sort(byTitle), [normalizedQuery, person, tasks]);
  const doneStage = stages.at(-1)?.id ?? "done";
  const stageForTask = (task: PlanningTask) => task.status === "completed" ? doneStage : stages.some((stage) => stage.id === task.stageId) ? task.stageId : stages[0]?.id;
  const drop = (event: DragEvent, stageId: string, position: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (id) updateTask(id, { stageId, position, status: stageId === doneStage ? "completed" : "open" });
  };

  return <>
    <div className="ticket-toolbar">
      <input aria-label="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks…" />
      <label className="planning-person-picker"><span>Tasks for</span><SearchableSelect ariaLabel="Tasks for person" value={person} onChange={setPerson} options={people.map((member) => ({ value: member, label: member === actor ? `${member} (you)` : member }))} /></label>
      <span className="toolbar-spacer" />
      <button type="button" className="button primary-button" onClick={() => setAdding(true)}>New task</button>
    </div>
    <PlanningAiBar organizationId={organizationId} projectId={projectId} kind="task" owner={person} features={features} onApply={(draft) => createTask({ title: draft.title, owner: person, featureNumber: draft.featureNumber, stageId: stages[0]?.id ?? "todo" })} />
    {adding ? <div className="board-task-composer"><TaskComposer owner={person} initialStageId={stages[0]?.id ?? "todo"} features={features} onCreate={(input) => { createTask(input); setAdding(false); }} saving={saving} /><button type="button" className="button" onClick={() => setAdding(false)}>Cancel</button></div> : null}
    <div className="ticket-board task-board">{stages.map((stage) => {
      const items = visibleTasks.filter((task) => stageForTask(task) === stage.id).sort((a, b) => a.position - b.position || byTitle(a, b));
      return <section className="ticket-column" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.id, items.length)}><header><span className="stage-title"><i style={{ background: stage.color }} /><b>{stage.label}</b></span><span>{items.length}</span></header>{items.map((task, index) => <div draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); drop(event, stage.id, index); }} key={task.id}><TaskCard task={task} feature={task.featureNumber === null ? null : featureByNumber.get(task.featureNumber) ?? null} color={stage.color} onToggle={() => updateTask(task.id, task.status === "open" ? { status: "completed", stageId: doneStage } : { status: "open", stageId: stages[0]?.id ?? "todo" })} onDelete={() => deleteTask(task.id)} /></div>)}</section>;
    })}</div>
  </>;
}

type PlanningDraft = { title: string; featureNumber: number | null };

function PlanningAiBar({ organizationId, projectId, kind, owner, features, onApply }: { organizationId: string; projectId: string; kind: "feature" | "task"; owner: string; features: TicketFeature[]; onApply: (draft: PlanningDraft) => void }) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<PlanningDraft | null>(null);
  const assist = useMutation({
    mutationFn: () => postRawJson<{ draft: PlanningDraft }>("/api/v1/planning/assist", {
      kind,
      prompt: prompt.trim(),
      owner,
      features: features.filter((feature) => !feature.closed).slice(0, 30).map((feature) => ({ number: feature.id, title: feature.title, owners: feature.owners })),
    }, { organizationId, projectId }),
    onSuccess: (result) => setDraft(result.draft),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (prompt.trim()) assist.mutate(); };
  const apply = () => { if (!draft) return; onApply(draft); setPrompt(""); setDraft(null); assist.reset(); };
  return <form className="planning-ai-bar" onSubmit={submit}>
    <span className="planning-ai-mark" aria-hidden="true">✦</span>
    <input aria-label={`Ask AI to draft a ${kind}`} value={prompt} maxLength={500} onChange={(event) => { setPrompt(event.target.value); setDraft(null); assist.reset(); }} placeholder={`Describe a ${kind} and let AI draft it…`} />
    {draft ? <><span className="planning-ai-draft" title={draft.title}>{draft.title}</span><button type="button" className="button primary-button" onClick={apply}>Create</button><button type="button" className="button" onClick={() => setDraft(null)}>Cancel</button></> : <button className="button" disabled={!prompt.trim() || assist.isPending}>{assist.isPending ? "Drafting…" : "Draft"}</button>}
    {assist.isError ? <span className="form-error" role="alert">{assist.error.message}</span> : null}
  </form>;
}

function TaskComposer({ owner, initialStageId, features, onCreate, saving }: { owner: string; initialStageId: string; features: TicketFeature[]; onCreate: (input: TaskInput) => void; saving: boolean }) {
  const [title, setTitle] = useState("");
  const [feature, setFeature] = useState("");
  const featureOptions = useMemo(() => features.filter((item) => !item.closed).sort((a, b) => Number(!featureOwnedBy(a, owner.toLowerCase())) - Number(!featureOwnedBy(b, owner.toLowerCase())) || byTitle(a, b)).map((item) => ({ value: String(item.id), label: `#${item.id} ${item.title}`, keywords: item.owners.join(" ") })), [features, owner]);
  const submit = (event: FormEvent) => { event.preventDefault(); const value = title.trim(); if (!value) return; onCreate({ title: value, owner, featureNumber: feature ? Number(feature) : null, stageId: initialStageId }); setTitle(""); };
  return <form className="task-composer" onSubmit={submit}>
    <input aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`Add a task for ${owner}…`} maxLength={200} />
    <SearchableSelect ariaLabel="Tie task to feature" value={feature} onChange={setFeature} options={featureOptions} emptyLabel="General task" placeholder="Search features…" />
    <button className="button primary-button" disabled={!title.trim() || saving}>Add task</button>
  </form>;
}

function TaskCard({ task, feature, color, onToggle, onDelete }: { task: PlanningTask; feature: TicketFeature | null; color: string; onToggle: () => void; onDelete: () => void }) {
  const { confirm, confirmation } = useConfirmDialog();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => { if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActionsOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); };
  }, [actionsOpen]);
  return <article className="ticket-card interactive-card task-card">
    <div className="ticket-card-heading"><button type="button" className="ticket-card-title" aria-label={`${task.status === "open" ? "Complete" : "Reopen"} ${task.title}`} onClick={onToggle}>{task.title}</button><div className="ticket-card-actions" ref={actionsRef}>
      <button type="button" className="ticket-card-action ticket-card-more" aria-label={`More actions for ${task.title}`} aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg></button>
      {actionsOpen ? <div className="ticket-card-menu" role="menu">
        <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onToggle(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><span>{task.status === "open" ? "Mark complete" : "Reopen task"}</span></button>
        <button type="button" role="menuitem" className="destructive" onClick={() => { setActionsOpen(false); void confirm({ title: "Delete task?", detail: `“${task.title}” will be permanently removed.`, confirmLabel: "Delete task", destructive: true }).then((confirmed) => { if (confirmed) onDelete(); }); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg><span>Delete task</span></button>
      </div> : null}
    </div></div>
    <div className="ticket-card-meta"><button type="button" className="task-card-status" style={{ color }} aria-label={`${task.status === "open" ? "Complete" : "Reopen"} ${task.title}`} onClick={onToggle}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><span>{task.status === "completed" ? "Done" : "Open"}</span></button><div className="ticket-card-assignment">
      <span className="ticket-assignee">{task.owner}</span>
    </div></div>
    {feature ? <small className="task-card-feature">Feature #{feature.id} · {feature.title}</small> : null}
    {confirmation}
  </article>;
}

const priorities: ReadonlyArray<{ value: Priority; label: string; color: string }> = [
  { value: 1, label: "Urgent", color: "#d84b4b" },
  { value: 2, label: "High", color: "#df7b3f" },
  { value: 3, label: "Medium", color: "#d1a22f" },
  { value: 4, label: "Low", color: "#4d78c8" },
  { value: 5, label: "Someday", color: "#8a929e" },
];

function PriorityFlag({ feature, onChange }: { feature: TicketFeature; onChange: (priority: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = priorities.find((priority) => priority.value === feature.priority) ?? priorities[2];
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const style = { color: selected.color, "--priority-index": selected.value - 1 } as CSSProperties;
  return <div className="priority-picker" ref={pickerRef} style={style} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <button type="button" className="priority-picker-trigger" aria-label={`Priority ${selected.value} · ${selected.label} for ${feature.title}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <PriorityIcon />
      <span aria-hidden="true">{selected.value}</span>
      <svg className="priority-picker-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    {open ? <div className="priority-picker-menu" role="listbox" aria-label={`Set priority for ${feature.title}`}>
      {priorities.map((priority) => <button type="button" role="option" aria-label={`${priority.value} · ${priority.label}`} aria-selected={priority.value === selected.value} className={priority.value === selected.value ? "selected" : ""} style={{ color: priority.color }} key={priority.value} onClick={() => { if (priority.value !== selected.value) onChange(priority.value); setOpen(false); }}>
        <PriorityIcon /><b>{priority.value}</b><span>{priority.label}</span>
      </button>)}
    </div> : null}
  </div>;
}

function PriorityIcon() {
  return <svg className="priority-picker-flag" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18M7 4h10l-2.5 4L17 12H7" /></svg>;
}

function FeatureCard({ organizationId, projectId, feature, members, onOpen, onPriority, onAssign, onMoveToBacklog, onDelete }: { organizationId: string; projectId: string; feature: TicketFeature; members: string[]; onOpen: () => void; onPriority: (priority: Priority) => void; onAssign: (owner: string | null) => void; onMoveToBacklog: () => void; onDelete: () => void }) {
  const { confirm, confirmation } = useConfirmDialog();
  const [assigning, setAssigning] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen]);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return <article className="ticket-card interactive-card">
    <div className="ticket-card-heading"><button type="button" className="ticket-card-title" onClick={onOpen}>{feature.title}</button><div className="ticket-card-actions" ref={actionsRef}>
      <button type="button" className="ticket-card-action ticket-card-more" aria-label={`More actions for ${feature.title}`} aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg></button>
      {actionsOpen ? <div className="ticket-card-menu" role="menu" onClick={stop} onKeyDown={stop}>
        <AttachmentUploadButton organizationId={organizationId} projectId={projectId} feature={feature} menu />
        <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); onMoveToBacklog(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 10l4 4 4-4M12 4v10" /></svg><span>Move to backlog</span></button>
        <button type="button" role="menuitem" className="destructive" onClick={() => { setActionsOpen(false); void confirm({ title: "Delete feature?", detail: `“${feature.title}” will be removed from planning.`, confirmLabel: "Delete feature", destructive: true }).then((confirmed) => { if (confirmed) onDelete(); }); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg><span>Delete feature</span></button>
      </div> : null}
    </div></div>
    <div className="ticket-card-meta"><PriorityFlag feature={feature} onChange={onPriority} /><div className="ticket-card-assignment" onClick={stop} onKeyDown={stop}>
      <button type="button" className="ticket-assignee" aria-label={`Assign owner for ${feature.title}`} aria-expanded={assigning} aria-haspopup="menu" onClick={() => setAssigning((current) => !current)}>{feature.owners.join(", ") || "Unassigned"}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button>
      {assigning ? <div className="ticket-assignee-menu"><SearchableSelect ariaLabel={`Assign owner for ${feature.title}`} value={feature.owners[0] ?? ""} emptyLabel="Unassigned" options={members.map((member) => ({ value: member, label: member }))} onChange={(owner) => { onAssign(owner || null); setAssigning(false); }} /></div> : null}
    </div></div>
    {confirmation}
  </article>;
}

function FeatureDialog({ organizationId, projectId, feature, stages, members, onClose, onSave }: { organizationId: string; projectId: string; feature: TicketFeature; stages: Stage[]; members: string[]; onClose: () => void; onSave: (feature: TicketFeature) => void }) {
  const [draft, setDraft] = useState(feature);
  const updateLink = (index: number, patch: Partial<FeatureLink>) => setDraft((current) => ({ ...current, links: current.links.map((link, linkIndex) => linkIndex === index ? { ...link, ...patch } : link) }));
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="ticket-dialog" role="dialog" aria-modal="true" aria-label={`Feature ${feature.title}`}>
    <header><div><span className="eyebrow">FEATURE #{feature.id}</span><input aria-label="Feature title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></div><button type="button" className="dialog-close" aria-label="Close feature" onClick={onClose}>×</button></header>
    <div className="ticket-dialog-grid"><main><label className="field-label">Description<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the outcome, context, and acceptance criteria…" /></label>
      <FeatureResources organizationId={organizationId} projectId={projectId} feature={feature} links={draft.links} onAddLink={() => setDraft((current) => ({ ...current, links: [...current.links, { url: "", label: "" }] }))} onUpdateLink={updateLink} onRemoveLink={(index) => setDraft((current) => ({ ...current, links: current.links.filter((_, linkIndex) => linkIndex !== index) }))} />
      <section className="dialog-section"><div className="dialog-section-heading"><div><b>Status history</b><small>Recorded workflow transitions</small></div></div><ol className="history-list">{draft.history.map((item, index) => <li key={`${item}-${index}`}><i /><span>{item}</span></li>)}</ol></section>
    </main><aside><label className="field-label">Stage<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value, history: [`Moved to ${stages.find((stage) => stage.id === event.target.value)?.label ?? event.target.value} · now`, ...current.history] }))}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.label}</option>)}</select></label>
      <label className="field-label">Owner<SearchableSelect ariaLabel="Feature owner" value={draft.owners[0] ?? ""} emptyLabel="Unassigned" options={members.map((member) => ({ value: member, label: member }))} onChange={(owner) => setDraft((current) => ({ ...current, owners: owner ? [owner] : [] }))} /></label>
      <label className="field-label">Placement<select value={draft.closed ? "completed" : draft.backlog ? "backlog" : "features"} onChange={(event) => setDraft((current) => ({ ...current, backlog: event.target.value === "backlog", closed: event.target.value === "completed" }))}><option value="features">Features</option><option value="backlog">Backlog</option><option value="completed">Completed</option></select></label>
      <div className="field-label">Priority<PriorityFlag feature={draft} onChange={(priority) => setDraft((current) => ({ ...current, priority }))} /></div>
      <button type="button" className="button" onClick={() => void navigator.clipboard?.writeText(window.location.href.split("?")[0] + `?feature=${feature.id}`)}>Copy feature link</button></aside></div>
    <footer><button type="button" className="button" onClick={onClose}>Cancel</button><button type="button" className="button primary-button" disabled={!draft.title.trim() || draft.links.some((link) => link.url && !/^https?:\/\//i.test(link.url))} onClick={() => onSave({ ...draft, title: draft.title.trim(), links: draft.links.filter((link) => link.url.trim()).map((link) => ({ url: link.url.trim(), ...(link.label?.trim() ? { label: link.label.trim() } : {}) })), updated: "Now" })}>Save feature</button></footer>
  </div></div>;
}

const featureAttachmentsKey = (organizationId: string, projectId: string, featureId: number) => ["ticket", organizationId, projectId, "feature", featureId, "attachments"] as const;

function AttachmentUploadButton({ organizationId, projectId, feature, text = false, menu = false }: { organizationId: string; projectId: string; feature: TicketFeature; text?: boolean; menu?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const key = featureAttachmentsKey(organizationId, projectId, feature.id);
  const upload = useMutation({
    mutationFn: (file: File) => platformApi.uploadTicketFeatureAttachment(organizationId, projectId, feature.id, file),
    onSuccess: (attachment) => queryClient.setQueryData<TicketFeatureAttachment[]>(key, (current = []) => [attachment, ...current.filter((item) => item.id !== attachment.id)]),
  });
  const choose = (event: React.MouseEvent) => { event.stopPropagation(); input.current?.click(); };
  return <>
    <input ref={input} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" aria-label={`Choose attachment for ${feature.title}`} onClick={(event) => event.stopPropagation()} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} />
    <button type="button" role={menu ? "menuitem" : undefined} className={menu ? "ticket-card-menu-item" : text ? "mini-button primary" : "ticket-card-action"} disabled={feature.id <= 0 || upload.isPending} aria-label={text ? undefined : `Attach file to ${feature.title}`} title={upload.error?.message ?? "Add screenshot or attachment"} onClick={choose}>
      {text ? (upload.isPending ? "Uploading…" : "Upload") : menu ? <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5l6.8-6.8a3 3 0 014.2 4.2l-8.8 8.8a5 5 0 01-7.1-7.1l8.1-8.1" /></svg><span>{upload.isPending ? "Uploading…" : "Add attachment"}</span></> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5l6.8-6.8a3 3 0 014.2 4.2l-8.8 8.8a5 5 0 01-7.1-7.1l8.1-8.1" /></svg>}
    </button>
  </>;
}

function FeatureResources({ organizationId, projectId, feature, links, onAddLink, onUpdateLink, onRemoveLink }: { organizationId: string; projectId: string; feature: TicketFeature; links: FeatureLink[]; onAddLink: () => void; onUpdateLink: (index: number, patch: Partial<FeatureLink>) => void; onRemoveLink: (index: number) => void }) {
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<{ attachment: TicketFeatureAttachment; url: string } | null>(null);
  const key = featureAttachmentsKey(organizationId, projectId, feature.id);
  const attachments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => platformApi.ticketFeatureAttachments(organizationId, projectId, feature.id, signal),
    enabled: feature.id > 0,
  });
  const remove = useMutation({
    mutationFn: (attachmentId: number) => platformApi.deleteTicketFeatureAttachment(organizationId, projectId, feature.id, attachmentId),
    onSuccess: (_result, attachmentId) => queryClient.setQueryData<TicketFeatureAttachment[]>(key, (current = []) => current.filter((item) => item.id !== attachmentId)),
  });
  return <section className="dialog-section feature-resources"><div className="dialog-section-heading"><div><b>Resources</b><small>Links, screenshots and PDFs in one place</small></div><div className="resource-actions"><button type="button" className="mini-button" onClick={onAddLink}>Add link</button><AttachmentUploadButton organizationId={organizationId} projectId={projectId} feature={feature} text /></div></div>
    {links.length ? <div className="feature-links-editor">{links.map((link, index) => <div className="feature-link-row" key={index}><input aria-label={`Link ${index + 1} label`} value={link.label ?? ""} onChange={(event) => onUpdateLink(index, { label: event.target.value })} placeholder="Label" /><input type="url" aria-label={`Link ${index + 1} URL`} value={link.url} onChange={(event) => onUpdateLink(index, { url: event.target.value })} placeholder="https://…" /><button type="button" className="ticket-card-action destructive" aria-label={`Remove link ${index + 1}`} onClick={() => onRemoveLink(index)}>×</button></div>)}</div> : null}
    {attachments.isLoading ? <p className="section-note">Loading attachments…</p> : null}
    {attachments.error ? <p className="form-error" role="alert">{attachments.error.message}</p> : null}
    {attachments.data?.length ? <div className="feature-attachment-grid">{attachments.data.map((attachment) => <FeatureAttachmentTile organizationId={organizationId} projectId={projectId} featureId={feature.id} attachment={attachment} deleting={remove.isPending && remove.variables === attachment.id} onView={(url) => setViewing({ attachment, url })} onDelete={() => remove.mutate(attachment.id)} key={attachment.id} />)}</div> : !attachments.isLoading && links.length === 0 ? <p className="section-note">No resources yet.</p> : null}
    {viewing ? <div className="attachment-viewer" role="dialog" aria-modal="true" aria-label={viewing.attachment.filename} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}><header><b>{viewing.attachment.filename}</b><button type="button" className="dialog-close" aria-label="Close attachment" onClick={() => setViewing(null)}>×</button></header>{viewing.attachment.kind === "image" ? <img src={viewing.url} alt={viewing.attachment.filename} /> : <iframe src={viewing.url} title={viewing.attachment.filename} />}</div> : null}
  </section>;
}

function FeatureAttachmentTile({ organizationId, projectId, featureId, attachment, deleting, onView, onDelete }: { organizationId: string; projectId: string; featureId: number; attachment: TicketFeatureAttachment; deleting: boolean; onView: (url: string) => void; onDelete: () => void }) {
  const preview = useQuery({
    queryKey: ["ticket", organizationId, projectId, "feature", featureId, "attachment", attachment.id],
    queryFn: async ({ signal }) => URL.createObjectURL(await platformApi.ticketFeatureAttachmentBlob(organizationId, projectId, featureId, attachment.id, signal)),
    staleTime: Infinity,
    gcTime: 0,
  });
  useEffect(() => {
    return () => { if (preview.data) URL.revokeObjectURL(preview.data); };
  }, [preview.data]);
  const url = preview.data ?? "";
  return <article className="feature-attachment-tile"><button type="button" className="feature-attachment-preview" aria-label={`View attachment ${attachment.filename}`} disabled={!url} onClick={() => onView(url)}>{attachment.kind === "image" && url ? <img src={url} alt="" /> : <span>{preview.isLoading ? "Loading…" : "PDF"}</span>}</button><div><b title={attachment.filename}>{attachment.filename}</b><small>{formatBytes(attachment.size)}</small></div><button type="button" className="ticket-card-action destructive" disabled={deleting} aria-label={`Delete attachment ${attachment.filename}`} onClick={onDelete}>×</button></article>;
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TicketSettings({ organizationId, projectId, repository, stages, setStages, saveStages, savingStages, stageSaveError, taskStages, setTaskStages, saveTaskStages, savingTaskStages, taskStageSaveError }: { organizationId: string; projectId: string; repository: string | null; stages: Stage[]; setStages: React.Dispatch<React.SetStateAction<Stage[]>>; saveStages: (stages: Stage[]) => void; savingStages: boolean; stageSaveError: Error | null; taskStages: Stage[]; setTaskStages: React.Dispatch<React.SetStateAction<Stage[]>>; saveTaskStages: (stages: Stage[]) => void; savingTaskStages: boolean; taskStageSaveError: Error | null }) {
  return <><NoxTicketSlackRoute organizationId={organizationId} projectId={projectId} />
    <StageSettings title="Feature board stages" detail="The last stage is treated as production when you clean the feature board." stages={stages} setStages={setStages} saveStages={saveStages} saving={savingStages} error={stageSaveError} />
    <StageSettings title="Task board stages" detail="Tasks move independently from features. The last stage completes a task." stages={taskStages} setStages={setTaskStages} saveStages={saveTaskStages} saving={savingTaskStages} error={taskStageSaveError} />
    <div className="settings-section"><div className="settings-section-head"><div><b>Feature repository</b><p>Planning stores features as GitHub-backed records in the connected project repository.</p></div><StatusTag tone={repository ? "positive" : "warning"}>{repository ? "Connected" : "Not configured"}</StatusTag></div><div className="list-surface"><ListRow symbol="R" tone={repository ? "positive" : "neutral"} title={repository ?? "No GitHub repository connected"} description="Feature source selected from repositories connected through NoxConnect" meta={<StatusTag>GitHub</StatusTag>} /></div></div></>;
}

function StageSettings({ title, detail, stages, setStages, saveStages, saving, error }: { title: string; detail: string; stages: Stage[]; setStages: React.Dispatch<React.SetStateAction<Stage[]>>; saveStages: (stages: Stage[]) => void; saving: boolean; error: Error | null }) {
  const update = (id: string, patch: Partial<Stage>) => setStages((current) => current.map((stage) => stage.id === id ? { ...stage, ...patch } : stage));
  const move = (index: number, direction: -1 | 1) => { const next = [...stages]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; saveStages(next); };
  const add = () => saveStages([...stages, { id: `stage-${Date.now()}`, label: "New stage", color: "#9a938d" }]);
  return <div className="settings-section"><div className="settings-section-head"><div><b>{title}</b><p>{detail}</p></div><button className="button" disabled={saving} onClick={add}>Add stage</button></div><div className="list-surface stage-editor">{stages.map((stage, index) => <div className="stage-editor-row" key={stage.id}><input type="color" aria-label={`${stage.label} color`} value={stage.color} disabled={saving} onChange={(event) => saveStages(stages.map((item) => item.id === stage.id ? { ...item, color: event.target.value } : item))} /><input aria-label={`Stage ${index + 1} name`} value={stage.label} disabled={saving} onChange={(event) => update(stage.id, { label: event.target.value })} onBlur={() => saveStages(stages)} /><span>{index === stages.length - 1 ? "Done stage" : index === 0 ? "Starting stage" : "Active stage"}</span><button className="mini-button" disabled={saving || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${stage.label} left`}>←</button><button className="mini-button" disabled={saving || index === stages.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${stage.label} right`}>→</button><button className="mini-button" disabled={saving || stages.length <= 1} onClick={() => saveStages(stages.filter((item) => item.id !== stage.id))}>Remove</button></div>)}</div>{saving ? <p className="form-success" role="status">Saving board stages…</p> : null}{error ? <p className="form-error" role="alert">{error.message}</p> : null}</div>;
}

function NoxTicketSlackRoute({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const routingKey = ["ticket", organizationId, projectId, "slack-routing"];
  const routing = useQuery({ queryKey: routingKey, queryFn: ({ signal }) => platformApi.slackRouting(organizationId, projectId, signal) });
  const status = useQuery({ queryKey: ["ticket", organizationId, projectId, "slack-status"], queryFn: ({ signal }) => platformApi.slackStatus(organizationId, projectId, signal) });
  const connection = status.data?.connections.find((item) => item.id === routing.data?.connections?.noxticket)
    ?? status.data?.connections.find((item) => item.projectId === projectId)
    ?? status.data?.connections.find((item) => item.id === status.data?.defaultConnectionId)
    ?? status.data?.connections[0];
  const channels = useQuery({
    queryKey: ["ticket", organizationId, projectId, "slack-channels", connection?.id],
    queryFn: ({ signal }) => platformApi.slackChannels(organizationId, projectId, connection?.id ?? "", signal),
    enabled: Boolean(status.data?.connected && connection?.id),
  });
  const saved = routing.data?.routes.noxticket ?? "";
  const selected = draft ?? saved;
  const options = (channels.data?.channels ?? []).filter((channel) => !channel.is_archived);
  // Save and test with the connection that actually produced this channel
  // list. This prevents a refetch or project switch from pairing a channel
  // with a stale workspace selected during the previous render.
  const activeConnectionId = channels.data?.connectionId ?? connection?.id ?? "";
  const routeIntegrityIssue = routing.data?.integrity?.issues.find((issue) => issue.route === "noxticket");
  const save = useMutation({
    mutationFn: () => platformApi.setNoxTicketSlackChannel(organizationId, projectId, selected ? activeConnectionId : null, selected || null),
    onSuccess: (next) => {
      queryClient.setQueryData(routingKey, next);
      setDraft(null);
      test.reset();
      setNotice(selected ? "Feature alerts are on." : "Feature alerts are off.");
    },
  });
  const test = useMutation({
    mutationFn: () => platformApi.testNoxTicketSlackChannel(organizationId, projectId, activeConnectionId, selected),
    onSuccess: () => setNotice("Test message delivered to Slack."),
  });
  const loading = routing.isLoading || status.isLoading || channels.isLoading;
  const connected = Boolean(status.data?.connected && connection);
  return <div className="settings-section"><div className="settings-section-head"><div><b>Feature alerts</b><p>Send the creator, title, description, and destination to Slack when a feature is added.</p></div><StatusTag tone={selected ? "positive" : "neutral"}>{selected ? "On" : "Off"}</StatusTag></div>
    {!status.isLoading && !connected ? <div className="callout ticket-slack-callout"><div><b>Connect Slack in NoxConnect</b><p>NoxConnect owns the workspace connection. Return here afterward to choose the channel for this project.</p></div><StatusTag>Not connected</StatusTag></div> : <div className="ticket-slack-route">
      <label>Slack channel<select aria-label="Planning feature alert channel" value={selected} disabled={loading || save.isPending} onChange={(event) => { setDraft(event.target.value); setNotice(null); save.reset(); test.reset(); }}><option value="">Off — do not send alerts</option>{options.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}{channel.is_private ? " · private" : ""}{!channel.is_member ? " · app not invited" : ""}</option>)}</select></label>
      <span className="ticket-slack-workspace">{connection?.teamName ?? "Slack"}</span>
      <button type="button" className="button" disabled={!selected || test.isPending || selected !== saved} onClick={() => test.mutate()}>{test.isPending ? "Sending…" : "Send test"}</button>
      <button type="button" className="button primary-button" disabled={save.isPending || (selected === saved && !routeIntegrityIssue)} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : routeIntegrityIssue ? "Repair route" : "Save"}</button>
    </div>}
    {routeIntegrityIssue ? <p className="form-error" role="alert">This Slack route refers to a workspace that is no longer connected. Choose the channel again and save it.</p> : null}
    {routing.isError || status.isError || channels.isError || save.isError || test.isError ? <p className="form-error" role="alert">{save.error instanceof Error ? save.error.message : test.error instanceof Error ? test.error.message : "Slack routing could not be loaded. Check the NoxConnect connection."}</p> : null}
    {notice ? <p className="form-success" role="status">{notice}</p> : null}
  </div>;
}

function matches(feature: TicketFeature, query: string, owner: string) { if (owner && !feature.owners.includes(owner)) return false; const normalized = query.trim().toLowerCase(); return !normalized || `${feature.title} ${feature.description} ${feature.links.map((link) => `${link.label ?? ""} ${link.url}`).join(" ")} ${feature.owners.join(" ")}`.toLowerCase().includes(normalized); }
function byTitle<T extends { title: string }>(a: T, b: T) { return a.title.localeCompare(b.title); }
function featureOwnedBy(feature: TicketFeature, person: string) { return feature.owners.length === 0 || feature.owners.some((owner) => owner.toLowerCase() === person); }

function changedFeatureFields(previous: TicketFeature, next: TicketFeature): TicketFeaturePatch {
  const patch: TicketFeaturePatch = {};
  if (previous.title !== next.title) patch.title = next.title;
  if (previous.status !== next.status) patch.status = next.status;
  if (previous.description !== next.description) patch.description = next.description;
  if (previous.backlog !== next.backlog) patch.backlog = next.backlog;
  if (previous.priority !== next.priority) patch.priority = next.priority;
  if (previous.closed !== next.closed) patch.state = next.closed ? "closed" : "open";
  if (JSON.stringify(previous.owners) !== JSON.stringify(next.owners)) patch.owners = next.owners;
  if (JSON.stringify(previous.links) !== JSON.stringify(next.links)) patch.links = next.links;
  return patch;
}
