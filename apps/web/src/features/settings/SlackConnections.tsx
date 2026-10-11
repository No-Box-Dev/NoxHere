import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, SlackStatus } from "../../api/contracts";
import { patchRawJson, postRawJson, type RequestScope } from "../../api/http";
import { platformApi } from "../../api/platform";
import { StatusTag } from "../../components/StatusTag";

type Connection = SlackStatus["connections"][number];
type OAuthStart = { url: string };

export function SlackConnections({ organizationId, projectId, projects, isAdmin }: { organizationId: string; projectId: string; projects: Project[]; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const scope: RequestScope = { organizationId, projectId };
  const queryKey = ["slack-connections", organizationId] as const;
  const status = useQuery({ queryKey, queryFn: ({ signal }) => platformApi.slackStatus(organizationId, projectId, signal) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["slack-message-status", organizationId] }),
    ]);
  };
  const start = useMutation({
    mutationFn: (input: { team: string | null; projectId: string }) => postRawJson<OAuthStart>("/api/v1/integrations/connections/slack/start", input, scope),
    onSuccess: (result) => window.location.assign(result.url),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { projectId?: string | null; displayName?: string | null } }) => patchRawJson(`/api/v1/slack/connections/${encodeURIComponent(id)}`, body, {}, scope),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: (connectionId: string) => postRawJson("/api/v1/slack/disconnect", { connectionId }, scope),
    onSuccess: refresh,
  });

  if (status.isLoading) return <div className="connect-empty"><b>Loading Slack connections</b><p>Reading organization workspaces and connection history…</p></div>;
  if (status.isError) return <div className="connect-empty"><b>Slack connections could not be loaded</b><p>{status.error instanceof Error ? status.error.message : "Try again in a moment."}</p></div>;
  const connections = status.data?.connections ?? [];
  return <>
    <div className="connect-inline-action"><p>Each workspace is an organization connection. Its project controls which Nox functionality may use it.</p>{isAdmin ? <button type="button" className="button primary-button" disabled={start.isPending} onClick={() => start.mutate({ team: null, projectId })}>{start.isPending ? "Opening Slack…" : "Add Slack workspace"}</button> : <StatusTag>View only</StatusTag>}</div>
    {connections.length ? <div className="list-surface slack-connection-list">{connections.map((connection) => <SlackConnectionRow key={connection.id} connection={connection} projects={projects} isAdmin={isAdmin} busy={update.isPending || disconnect.isPending || start.isPending} onUpdate={(body) => update.mutate({ id: connection.id, body })} onReconnect={() => start.mutate({ team: connection.teamId, projectId: connection.projectId ?? projectId })} onDisconnect={() => {
      if (window.confirm(`Disconnect ${connection.displayName || connection.teamName}? Nox will stop sending to channels that use it.`)) disconnect.mutate(connection.id);
    }} />)}</div> : <div className="connect-empty"><b>No Slack workspaces connected</b><p>An organization admin can add the first workspace here. Tokens stay encrypted and are never returned to the browser.</p></div>}
    {(start.error || update.error || disconnect.error) ? <p className="form-error" role="alert">{errorMessage(start.error || update.error || disconnect.error)}</p> : null}
    <p className="section-note">Nox records who first opened a connection, who last reconnected it, and when it was last used successfully. Removing a workspace also clears routes that depended on it.</p>
  </>;
}

function SlackConnectionRow({ connection, projects, isAdmin, busy, onUpdate, onReconnect, onDisconnect }: { connection: Connection; projects: Project[]; isAdmin: boolean; busy: boolean; onUpdate: (body: { projectId?: string | null; displayName?: string | null }) => void; onReconnect: () => void; onDisconnect: () => void }) {
  const [name, setName] = useState(connection.displayName ?? "");
  const effectiveName = connection.displayName || connection.teamName;
  const detail = [
    connection.createdBy ? `Opened by ${connection.createdBy}${connection.createdAt ? ` ${formatDate(connection.createdAt)}` : ""}` : null,
    connection.connectedBy && connection.connectedBy !== connection.createdBy ? `Reconnected by ${connection.connectedBy}` : null,
    connection.lastUsedAt ? `Last used ${formatDate(connection.lastUsedAt)}` : "Not used yet",
  ].filter(Boolean).join(" · ");
  return <div className="list-row slack-connection-row">
    <span className="row-symbol">S</span>
    <span className="list-copy"><b>{effectiveName}</b><small>{connection.displayName ? `${connection.teamName} · ` : ""}{detail}</small>{connection.lastError ? <small className="form-error">{connection.lastError}</small> : null}</span>
    <span className="list-meta slack-connection-controls">
      <StatusTag tone={connection.health === "ok" && !connection.needsReconnect ? "positive" : "warning"}>{connection.needsReconnect ? "Reconnect" : connection.health === "ok" ? "Healthy" : connection.health ?? "Unknown"}</StatusTag>
      {isAdmin ? <>
        <label><span>Name</span><input aria-label={`Connection name for ${connection.teamName}`} value={name} placeholder={connection.teamName} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <button type="button" className="mini-button" disabled={busy || name.trim() === (connection.displayName ?? "")} onClick={() => onUpdate({ displayName: name.trim() || null })}>Save name</button>
        <label><span>Project</span><select aria-label={`Project for ${effectiveName}`} value={connection.projectId ?? ""} disabled={busy} onChange={(event) => onUpdate({ projectId: event.target.value || null })}><option value="">Organization-wide</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <button type="button" className="mini-button" disabled={busy} onClick={onReconnect}>Reconnect</button>
        <button type="button" className="mini-button danger" disabled={busy} onClick={onDisconnect}>Disconnect</button>
      </> : <span>{connection.projectName ?? "Organization-wide"}</span>}
    </span>
  </div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The Slack connection change could not be saved.";
}
