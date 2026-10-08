import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { SlackMessagePayload } from "../../api/contracts";
import { platformApi } from "../../api/platform";

const SUPPORTED_FIELDS = [
  "text", "markdown_text", "blocks", "attachments", "metadata", "thread_ts",
  "reply_broadcast", "mrkdwn", "parse", "link_names", "unfurl_links",
  "unfurl_media", "username", "icon_emoji", "icon_url", "client_msg_id",
] as const;

export function SlackMessageBridge({ organizationId, projectId, isAdmin }: { organizationId: string; projectId: string; isAdmin: boolean }) {
  const [connectionId, setConnectionId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [advancedJson, setAdvancedJson] = useState("");
  const [localError, setLocalError] = useState("");
  const status = useQuery({
    queryKey: ["slack-message-status", organizationId, projectId],
    queryFn: ({ signal }) => platformApi.slackStatus(organizationId, projectId, signal),
    enabled: isAdmin,
  });
  const connections = useMemo(() => status.data?.connections.filter((connection) => !connection.projectId || connection.projectId === projectId) ?? [], [status.data, projectId]);
  const preferredConnection = connections.find((connection) => connection.id === status.data?.defaultConnectionId) ?? connections[0];
  const effectiveConnectionId = connectionId || preferredConnection?.id || "";

  const channels = useQuery({
    queryKey: ["slack-message-channels", organizationId, projectId, effectiveConnectionId],
    queryFn: ({ signal }) => platformApi.slackChannels(organizationId, projectId, effectiveConnectionId, signal),
    enabled: isAdmin && Boolean(effectiveConnectionId),
  });
  const send = useMutation({
    mutationFn: (message: SlackMessagePayload) => platformApi.sendSlackMessage(organizationId, projectId, effectiveConnectionId, channelId, message),
    onSuccess: () => {
      setText("");
      setImageUrl("");
      setImageAlt("");
      setImageTitle("");
      setAdvancedJson("");
      setLocalError("");
    },
  });

  if (!isAdmin) return <div className="connect-empty"><b>Admin access required</b><p>Only an organization admin can send messages through a connected Slack workspace.</p></div>;
  if (status.isLoading) return <div className="connect-empty"><b>Loading Slack</b><p>Reading the connected workspaces…</p></div>;
  if (status.isError) return <div className="connect-empty"><b>Slack could not be loaded</b><p>{status.error instanceof Error ? status.error.message : "Try again after the connection is available."}</p></div>;
  if (!status.data?.connected || connections.length === 0) return <div className="connect-empty"><b>Connect Slack first</b><p>Add a Slack workspace in NoxConnect before sending a message.</p></div>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    send.reset();
    if (!effectiveConnectionId) return setLocalError("Choose a Slack workspace before sending the message.");
    if (!channelId) return setLocalError("Choose a Slack channel before sending the message.");
    if (imageUrl.trim() && !imageAlt.trim()) return setLocalError("Add alternative text for the image before sending.");

    let advanced: Record<string, unknown> = {};
    if (advancedJson.trim()) {
      try {
        const parsed = JSON.parse(advancedJson) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not_object");
        advanced = parsed as Record<string, unknown>;
      } catch {
        return setLocalError("Additional Slack fields must be a valid JSON object.");
      }
    }
    const unsupported = Object.keys(advanced).filter((field) => !SUPPORTED_FIELDS.includes(field as typeof SUPPORTED_FIELDS[number]));
    if (unsupported.length) return setLocalError(`Unsupported Slack field${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}.`);

    const message: SlackMessagePayload = { ...advanced } as SlackMessagePayload;
    if (text.trim()) message.text = text.trim();
    if (imageUrl.trim()) {
      try {
        const url = new URL(imageUrl.trim());
        if (url.protocol !== "https:") throw new Error("not_https");
      } catch {
        return setLocalError("Image URL must be a valid public HTTPS URL.");
      }
      const imageBlock: Record<string, unknown> = {
        type: "image",
        image_url: imageUrl.trim(),
        alt_text: imageAlt.trim(),
        ...(imageTitle.trim() ? { title: { type: "plain_text", text: imageTitle.trim() } } : {}),
      };
      message.blocks = [...(Array.isArray(message.blocks) ? message.blocks : []), imageBlock];
    }
    if (!message.text && !message.markdown_text && !message.blocks?.length && !message.attachments?.length) {
      return setLocalError("Add a message, image, Block Kit block, or attachment before sending.");
    }
    send.mutate(message);
  };

  return <form className="slack-message-bridge" onSubmit={submit}>
    <div className="connect-inline-action"><p>Send one message through the existing encrypted Slack connection. Images use Slack image blocks and must have a public HTTPS URL.</p><span className="slack-bridge-badge">Direct delivery</span></div>
    <div className="slack-bridge-destination">
      <label><span>Workspace</span><select aria-label="Slack workspace" value={effectiveConnectionId} onChange={(event) => { setConnectionId(event.target.value); setChannelId(""); }}><option value="">Choose workspace</option>{connections.map((connection) => <option value={connection.id} key={connection.id}>{connection.teamName}</option>)}</select></label>
      <label><span>Channel</span><select aria-label="Slack channel" value={channelId} disabled={!effectiveConnectionId || channels.isLoading} onChange={(event) => setChannelId(event.target.value)}><option value="">{channels.isLoading ? "Loading channels…" : "Choose channel"}</option>{(channels.data?.channels ?? []).filter((channel) => !channel.is_archived).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}{channel.is_private ? " · private" : ""}</option>)}</select></label>
    </div>
    {channels.isError ? <p className="form-error" role="alert">{channels.error instanceof Error ? channels.error.message : "Slack channels could not be loaded."}</p> : null}
    <label className="slack-bridge-field"><span>Message</span><textarea aria-label="Slack message" rows={5} value={text} onChange={(event) => setText(event.target.value)} placeholder="Write the message Slack should receive…" /></label>
    <fieldset className="slack-image-fields"><legend>Optional image</legend><label><span>Public image URL</span><input aria-label="Public image URL" type="url" inputMode="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…/image.png" /></label><label><span>Alternative text</span><input aria-label="Image alternative text" value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="Describe the image" /></label><label><span>Title</span><input aria-label="Image title" value={imageTitle} onChange={(event) => setImageTitle(event.target.value)} placeholder="Optional" /></label></fieldset>
    <details className="slack-advanced"><summary>Advanced Slack fields</summary><p>JSON object supporting {SUPPORTED_FIELDS.join(", ")}. Blocks and attachments follow Slack’s native JSON format. Custom username or icon fields require the workspace to have approved Slack’s customize permission.</p><textarea aria-label="Additional Slack fields JSON" rows={8} value={advancedJson} onChange={(event) => setAdvancedJson(event.target.value)} placeholder={'{"unfurl_links": false, "thread_ts": "1234567890.123456"}'} /></details>
    <div className="slack-bridge-actions"><button className="button primary-button" disabled={send.isPending}>{send.isPending ? "Sending…" : "Send to Slack"}</button>{send.isSuccess ? <span className="form-success" role="status">Message sent to the selected Slack channel.</span> : null}</div>
    {localError ? <p className="form-error" role="alert">{localError}</p> : null}
    {send.isError ? <p className="form-error" role="alert">{send.error instanceof Error ? send.error.message : "Slack did not accept the message."}</p> : null}
  </form>;
}
