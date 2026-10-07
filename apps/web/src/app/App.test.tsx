import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { App } from "./App";
import { renderApp } from "../test/render";

const project = {
  id: "proj_no-box-dev_playnist",
  name: "playnist",
  org: "No-Box-Dev",
  repo: "nox-test-sandbox",
  repositories: ["nox-test-sandbox"],
  description: null,
  archived: 0,
};

function CurrentRoute() {
  return <output data-testid="current-route">{useLocation().pathname}</output>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/auth/profile") return json({ user: { login: "JasperNoBoxDev", email: "jasper@noboxdev.com" }, orgs: [{ login: "No-Box-Dev", role: "admin" }] });
    if (url === "/api/v1/me") return json({ login: "JasperNoBoxDev", org: "No-Box-Dev", isAdmin: true });
    if (url === `/api/v1/projects/${project.id}/cue/actions`) return json({ projectId: project.id, windowDays: 7, actions: [
      { slot: 1, key: "custom.comments.written", label: "Comments written" },
      { slot: 2, key: "custom.journals.added", label: "Journals added" },
      { slot: 3, key: "custom.reviews.written", label: "Reviews written" },
    ], snippet: "" });
    if (url.startsWith(`/api/v1/projects/${project.id}/cue/dashboard`)) return json({ range: "30d", dateLabel: "Last 30 days", reportStatus: "Live", stats: [] });
    if (url === "/api/v1/projects/routing") return json({
      projects: [{
        id: project.id,
        name: project.name,
        archived: false,
        enabled: true,
        repositories: project.repositories,
        routes: {
          noxfeedPosts: { connectionId: "", channelId: "" },
          noxfeedReleaseNotes: { connectionId: "", channelId: "" },
          noxCue: { connectionId: "", channelId: "" },
          noxCueAlerts: { connectionId: "", channelId: "" },
        },
      }],
      repositories: ["api", "nox-test-sandbox"],
    });
    if (url === `/api/v1/projects/${project.id}/routing` && init?.method === "PUT") return json({ ok: true });
    if (url === "/api/v1/projects" && init?.method === "POST") {
      const input = JSON.parse(String(init.body));
      return json({ project: { id: "proj_created", name: input.name, repositories: input.repositories ?? [] } }, 201);
    }
    if (url.startsWith("/api/v1/projects")) return json({ projects: [project] });
    if (url.startsWith("/api/v1/actors")) return json({ actors: [{ github_login: "JasperNoBoxDev", avatar_url: "https://avatars.githubusercontent.com/u/196446605?v=4" }] });
    if (url.startsWith("/api/v1/integrations/connections")) return json({ github: { connected: true }, slack: { connected: false } });
    if (url === "/api/v1/integrations/slack/routing" && init?.method === "PATCH") return json({ routes: { noxticket: "C-FEATURES" }, connections: { noxticket: "conn-1" } });
    if (url === "/api/v1/integrations/slack/routing") return json({ routes: { noxticket: null }, connections: { noxticket: null } });
    if (url === "/api/v1/slack/status") return json({ connected: true, defaultConnectionId: "conn-1", connections: [{ id: "conn-1", teamName: "No Box Dev", isDefault: true, projectId: project.id }] });
    if (url.startsWith("/api/v1/slack/channels")) return json({ connectionId: "conn-1", channels: [{ id: "C-FEATURES", name: "feature-alerts", is_private: false, is_archived: false, is_member: true }] });
    if (url === "/api/v1/guests/invites" && init?.method === "POST") return json({ invitation: { id: "invite-1", email: "guest@example.com", scopeType: "project", projectId: project.id, service: null, expiresAt: "2026-09-27T00:00:00.000Z" } }, 201);
    if (url === "/api/v1/guests") return json({ grants: [], invitations: [] });
    if (url === "/api/v1/members") return json([
      { login: "JasperNoBoxDev", avatar_url: "https://avatars.githubusercontent.com/u/196446605?v=4", kind: "human" },
      { login: "memenoboxdev", avatar_url: "https://avatars.githubusercontent.com/u/252885663?v=4", kind: "human" },
      { login: "repo-guest", avatar_url: "https://avatars.githubusercontent.com/u/123?v=4", kind: "contributor" },
    ]);
    if (url === "/api/v1/config/settings" && init?.method === "PUT") return json({ ok: true });
    if (url === "/api/v1/config/settings") return json({ excludedMembers: ["memenoboxdev"] });
    if (url.startsWith("/api/v1/features?state=all")) return json([]);
    if (url.startsWith("/api/v1/specs")) return json({ specs: [] });
    if (url.startsWith("/api/v1/prs") || url.startsWith("/api/v1/issues")) return json({ data: [], totalCount: 0, page: 1, pageSize: 100 });
    if (url.startsWith("/api/v1/spots/project-overview")) return json({ issues: [] });
    if (url === "/api/v1/spots/sites") return json({ sites: [{ id: "site-playnist", name: "Playnist", projectId: project.id }] });
    if (url === "/api/v1/spots/sites/site-playnist/resolution-template" && init?.method === "PATCH") return json({
      template: JSON.parse(String(init.body)).template,
      defaults: resolutionTemplate,
      usingDefault: false,
      revision: "b".repeat(64),
    });
    if (url === "/api/v1/spots/sites/site-playnist/resolution-template") return json({ template: resolutionTemplate, defaults: resolutionTemplate, usingDefault: false, revision: "a".repeat(64) });
    if (url === "/api/v1/spots/sites/site-playnist/resolution-template/preview") return json({ preview: { ...resolutionTemplate, siteName: "Playnist", greeting: "Hi Alex,", summary: "The issue is fixed." } });
    return json({ error: { code: "not_found", message: "Not found" } }, 404);
  }));
});

const resolutionTemplate = {
  tone: "warm",
  senderName: "Playnist",
  subject: "Update on your Playnist issue: {{report_title}}",
  acknowledgement: "Thanks for reporting “{{report_title}}”.",
  reopenText: "If the issue is still happening, reopen the ticket.",
  buttonLabel: "Reopen the ticket",
  closing: "Thank you again for helping us improve {{site_name}}.",
  replyTo: "jasper@noboxdev.com",
  appearance: { accentColor: "#C62E07", backgroundColor: "#FFFDEB", surfaceColor: "#FFFFFF", textColor: "#1A1A1A", mutedColor: "#525252", fontPreset: "playnist" },
};

afterEach(() => vi.unstubAllGlobals());

describe("NoxConnect API-backed platform", () => {
  it("sends a text and image message through the selected Slack connection", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/integrations/slack/messages" && init?.method === "POST") {
        return json({ apiVersion: 1, delivery: { status: "sent", connectionId: "conn-1", channelId: "C-FEATURES", messageTs: "1730000000.123456", sentAt: "2026-10-07T12:00:00.000Z" } }, 201);
      }
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/settings");

    await user.click(await screen.findByRole("button", { name: "Toggle Send to Slack" }));
    await user.click(screen.getByRole("button", { name: "Send to Slack" }));
    expect(await screen.findByText("Choose a Slack channel before sending the message.")).toHaveAttribute("role", "alert");

    await user.selectOptions(screen.getByRole("combobox", { name: "Slack channel" }), "C-FEATURES");
    await user.type(screen.getByRole("textbox", { name: "Slack message" }), "Release ready");
    await user.type(screen.getByRole("textbox", { name: "Public image URL" }), "https://example.com/release.png");
    await user.type(screen.getByRole("textbox", { name: "Image alternative text" }), "Release graph");
    await user.click(screen.getByRole("button", { name: "Send to Slack" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Message sent");
    const request = vi.mocked(fetch).mock.calls.find(([input, init]) => String(input) === "/api/v1/integrations/slack/messages" && init?.method === "POST")?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      connectionId: "conn-1",
      channelId: "C-FEATURES",
      message: {
        text: "Release ready",
        blocks: [{ type: "image", image_url: "https://example.com/release.png", alt_text: "Release graph" }],
      },
    });
  });

  it("opens the first authorized project after login without using a placeholder project URL", async () => {
    renderApp(<><App /><CurrentRoute /></>, "/");

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent(
      "/no-box-dev/proj_no-box-dev_playnist/connect/overview",
    ));
    expect(await screen.findByRole("link", { name: "NoxConnect" })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => new Headers(init?.headers).get("X-Project-ID") === "select")).toBe(false);
  });

  it("repairs the former placeholder project URL", async () => {
    renderApp(<><App /><CurrentRoute /></>, "/no-box-dev/select/connect/overview");

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent(
      "/no-box-dev/proj_no-box-dev_playnist/connect/overview",
    ));
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => new Headers(init?.headers).get("X-Project-ID") === "select")).toBe(false);
  });

  it("always shows every available capability for a verified member", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/connect/overview");

    expect(await screen.findByRole("link", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NoxKey" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NoxConnect" })).toBeInTheDocument();
  });

  it("returns to sign-in when an authenticated API request reports an expired session", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/me") {
        return json({ apiVersion: 1, error: { code: "unauthorized", message: "Session expired; sign in again" } }, 401);
      }
      return baseFetch(input, init);
    });

    renderApp(<App />, "/n1healthcare/select/connect/overview");

    expect(await screen.findByRole("heading", { name: "Sign in to Nox" })).toBeInTheDocument();
    expect(screen.queryByText("Could not load this view")).not.toBeInTheDocument();
  });

  it("renders the main project with API-backed empty states", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    expect(await screen.findByRole("button", { name: "New feature" }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText("No Planning records yet")).not.toBeInTheDocument();
    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/features?state=all", expect.objectContaining({ headers: expect.objectContaining({ "X-Project-ID": "proj_no-box-dev_playnist" }) }));
  });

  it("adds a feature optimistically and reconciles it with the saved record", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let resolveCreate!: (response: Response) => void;
    const pendingCreate = new Promise<Response>((resolve) => { resolveCreate = resolve; });
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/features" && init?.method === "POST") return pendingCreate;
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    await user.click(await screen.findByRole("button", { name: "New feature" }));
    await user.type(screen.getByRole("textbox", { name: "Feature title" }), "Instant feature");
    await user.click(screen.getByRole("button", { name: "Create feature" }));

    expect(screen.getByText("Instant feature")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/features", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"title":"Instant feature"'),
    }));

    resolveCreate(json({ number: 41, title: "Instant feature", state: "open", status: "todo", backlog: false, priority: 3, owners: [], description: "", links: [], updatedAt: "2026-10-01T00:00:00.000Z" }, 201));
    await waitFor(() => expect(screen.getAllByText("Instant feature")).toHaveLength(1));
  });

  it("keeps a Planning card in its new column after the canonical PATCH response", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 1, title: "Move me", state: "open", status: "todo", backlog: false, owners: [], plan: "", updatedAt: "2026-09-27T00:00:00.000Z" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/1" && init?.method === "PATCH") {
        return json({ ...feature, ...JSON.parse(String(init.body)), updatedAt: "2026-09-27T01:00:00.000Z" });
      }
      return baseFetch(input, init);
    });

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    const title = await screen.findByText("Move me");
    const card = title.closest("article");
    const target = screen.getByText("Specced").closest("section");
    expect(card).not.toBeNull();
    expect(target).not.toBeNull();
    const transfer = { setData: vi.fn(), getData: vi.fn(() => "1"), effectAllowed: "none" };
    fireEvent.dragStart(card!, { dataTransfer: transfer });
    fireEvent.drop(target!, { dataTransfer: transfer });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/1", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"status":"specced"'),
    })));
    await waitFor(() => expect(within(target!).getByText("Move me")).toBeInTheDocument());
  });

  it("persists board-stage removal and restores the saved workflow after reload", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let savedSettings: Record<string, unknown> = { excludedMembers: ["memenoboxdev"] };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/config/settings" && init?.method === "PUT") {
        savedSettings = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({ ok: true });
      }
      if (String(input) === "/api/v1/config/settings") return json(savedSettings);
      return baseFetch(input, init);
    });

    const settingsView = renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/settings");
    const speccedInput = await screen.findByDisplayValue("Specced");
    await userEvent.click(within(speccedInput.closest(".stage-editor-row")!).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(savedSettings).toMatchObject({
      excludedMembers: ["memenoboxdev"],
      boardStages: expect.not.arrayContaining([expect.objectContaining({ id: "specced" })]),
    }));
    settingsView.unmount();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    expect(await screen.findByText("To do")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Specced")).not.toBeInTheDocument());
  });

  it("moves every production card to the Completed tab", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 8, title: "Ready to complete", state: "open", status: "production", backlog: false, owners: [], plan: "", updatedAt: "2026-09-27T00:00:00.000Z" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/8" && init?.method === "PATCH") {
        return json({ ...feature, ...JSON.parse(String(init.body)), updatedAt: "2026-09-27T01:00:00.000Z" });
      }
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    await user.click(await screen.findByRole("button", { name: "Move production to completed (1)" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/8", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"state":"closed"'),
    })));
    await user.click(screen.getByRole("link", { name: "Completed" }));
    expect(await screen.findByText("Ready to complete")).toBeInTheDocument();
  });

  it("uses one Planning menu for Features, Backlog, Completed, and Settings", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");

    const planningMenu = await screen.findByRole("navigation", { name: "Service views" });
    expect(within(planningMenu).getByRole("link", { name: "Features" })).toHaveClass("active");
    expect(within(planningMenu).getByRole("link", { name: "Backlog" })).toBeInTheDocument();
    expect(within(planningMenu).getByRole("link", { name: "Completed" })).toBeInTheDocument();
    expect(within(planningMenu).getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(within(planningMenu).queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Feature views" })).not.toBeInTheDocument();
  });

  it("deletes a feature directly from its Backlog row", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 9, title: "Parked idea", state: "open", status: "todo", backlog: true, owners: [], description: "Later", links: [], updatedAt: "2026-09-27T00:00:00.000Z" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/9" && init?.method === "DELETE") return json({ ok: true });
      return baseFetch(input, init);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board?view=backlog");
    await user.click(await screen.findByRole("button", { name: "Delete Parked idea" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/9", expect.objectContaining({ method: "DELETE" })));
    expect(screen.queryByText("Parked idea")).not.toBeInTheDocument();
  });

  it("moves a backlog feature with a backlog-only patch", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 10, title: "Old parked idea", state: "open", status: "legacy-stage", backlog: true, priority: 3, owners: [], description: "Later", links: [], updatedAt: "2026-09-27T00:00:00.000Z" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/10" && init?.method === "PATCH") return json({ ...feature, backlog: false });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board?view=backlog");
    await user.click(await screen.findByRole("button", { name: "Move to features" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/10", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ backlog: false }),
    })));
    expect(screen.queryByText("Old parked idea")).not.toBeInTheDocument();
  });

  it("persists priority repeatedly from the branded Backlog flag menu", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 11, title: "Prioritise me", state: "open", status: "todo", backlog: true, priority: 3, owners: [], description: "", links: [], updatedAt: "2026-09-27T00:00:00.000Z" };
    const secondFeature = { ...feature, number: 12, title: "Prioritise next", priority: 5 };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature, secondFeature]);
      if (url === "/api/v1/features/11" && init?.method === "PATCH") return json({ ...feature, ...JSON.parse(String(init.body)) });
      if (url === "/api/v1/features/12" && init?.method === "PATCH") return json({ ...secondFeature, ...JSON.parse(String(init.body)) });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board?view=backlog");
    const firstPriority = await screen.findByRole("button", { name: "Priority 3 · Medium for Prioritise me" });
    await user.click(firstPriority);
    const firstMenu = screen.getByRole("listbox", { name: "Set priority for Prioritise me" });
    expect(within(firstMenu).getAllByRole("option")).toHaveLength(5);
    await user.click(within(firstMenu).getByRole("option", { name: "1 · Urgent" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/11", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"priority":1'),
    })));
    expect(screen.getByRole("button", { name: "Priority 1 · Urgent for Prioritise me" })).toBeInTheDocument();

    const secondPriority = screen.getByRole("button", { name: "Priority 5 · Someday for Prioritise next" });
    await user.click(secondPriority);
    await user.click(within(screen.getByRole("listbox", { name: "Set priority for Prioritise next" })).getByRole("option", { name: "2 · High" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/12", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"priority":2'),
    })));
    expect(screen.getByRole("button", { name: "Priority 2 · High for Prioritise next" })).toBeInTheDocument();
  });

  it("shows the same priority picker in Features, Backlog, and Completed", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const records = [
      { number: 21, title: "Active priority", state: "open", status: "todo", backlog: false, priority: 1, owners: [], description: "", links: [], updatedAt: "2026-09-27T00:00:00.000Z" },
      { number: 22, title: "Backlog priority", state: "open", status: "todo", backlog: true, priority: 3, owners: [], description: "", links: [], updatedAt: "2026-09-27T00:00:00.000Z" },
      { number: 23, title: "Completed priority", state: "closed", status: "production", backlog: false, priority: 5, owners: [], description: "", links: [], updatedAt: "2026-09-27T00:00:00.000Z" },
    ];
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/features?state=all") return json(records);
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    expect(await screen.findByRole("button", { name: "Priority 1 · Urgent for Active priority" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Backlog" }));
    expect(await screen.findByRole("button", { name: "Priority 3 · Medium for Backlog priority" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Completed" }));
    expect(await screen.findByRole("button", { name: "Priority 5 · Someday for Completed priority" })).toBeInTheDocument();
  });

  it("keeps a separate search query for Features, Backlog, and Completed", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const records = [
      { number: 41, title: "Active discovery", state: "open", status: "todo", backlog: false, priority: 3, owners: [], description: "", links: [] },
      { number: 42, title: "Backlog browser", state: "open", status: "todo", backlog: true, priority: 3, owners: [], description: "", links: [] },
      { number: 43, title: "Completed import", state: "closed", status: "production", backlog: false, priority: 3, owners: [], description: "", links: [] },
    ];
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/features?state=all") return json(records);
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    const featureSearch = await screen.findByRole("textbox", { name: "Search features" });
    await user.type(featureSearch, "discovery");
    expect(featureSearch).toHaveValue("discovery");

    await user.click(screen.getByRole("link", { name: "Backlog" }));
    const backlogSearch = await screen.findByRole("textbox", { name: "Search backlog" });
    expect(backlogSearch).toHaveValue("");
    await user.type(backlogSearch, "browser");

    await user.click(screen.getByRole("link", { name: "Completed" }));
    const completedSearch = await screen.findByRole("textbox", { name: "Search completed" });
    expect(completedSearch).toHaveValue("");
    await user.type(completedSearch, "import");

    await user.click(screen.getByRole("link", { name: "Features" }));
    expect(await screen.findByRole("textbox", { name: "Search features" })).toHaveValue("discovery");
  });

  it("saves feature descriptions and multiple links without Specs", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 10, title: "Sharing", state: "open", status: "todo", backlog: false, owners: [], description: "Old description", links: [], updatedAt: "2026-09-27T00:00:00.000Z" };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/10" && init?.method === "PATCH") return json({ ...feature, ...JSON.parse(String(init.body)) });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    await user.click(await screen.findByText("Sharing"));
    const dialog = screen.getByRole("dialog", { name: "Feature Sharing" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Owner" }), "JasperNoBoxDev");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Placement" }), "backlog");
    await user.click(within(dialog).getByRole("button", { name: "Priority 3 · Medium for Sharing" }));
    await user.click(within(dialog).getByRole("option", { name: "2 · High" }));
    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Share collections anywhere.");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    await user.type(screen.getByLabelText("Link 1 label"), "Design");
    await user.type(screen.getByLabelText("Link 1 URL"), "https://figma.com/example");
    await user.click(screen.getByRole("button", { name: "Save feature" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/features/10", expect.objectContaining({
      method: "PATCH",
      body: expect.stringContaining('"description":"Share collections anywhere."'),
    })));
    const updateBody = vi.mocked(fetch).mock.calls.find(([input, init]) => String(input) === "/api/v1/features/10" && init?.method === "PATCH")?.[1]?.body;
    expect(String(updateBody)).toContain('"owners":["JasperNoBoxDev"]');
    expect(String(updateBody)).toContain('"backlog":true');
    expect(String(updateBody)).toContain('"priority":2');
    expect(screen.queryByRole("link", { name: "Specs" })).not.toBeInTheDocument();
  });

  it("uploads and previews screenshots attached to a feature card", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const feature = { number: 31, title: "Attachable", state: "open", status: "todo", backlog: false, priority: 3, owners: [], description: "", links: [], updatedAt: "2026-10-01T00:00:00.000Z" };
    const screenshot = { id: 7, filename: "screen.png", contentType: "image/png", size: 2048, uploadedBy: "JasperNoBoxDev", uploadedAt: "2026-10-01T00:00:00.000Z", kind: "image" };
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL() { return "blob:attachment-preview"; }
      static revokeObjectURL() { /* test blob */ }
    });
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/features?state=all") return json([feature]);
      if (url === "/api/v1/features/31/attachments" && init?.method === "POST") return json({ ...screenshot, id: 8, filename: "new-screen.png" }, 201);
      if (url === "/api/v1/features/31/attachments") return json({ attachments: [screenshot] });
      if (url === "/api/v1/features/31/attachments/7" || url === "/api/v1/features/31/attachments/8") return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/board");
    await user.click(await screen.findByRole("button", { name: "More actions for Attachable" }));
    expect(await screen.findByRole("menuitem", { name: "Attach file to Attachable" })).toBeInTheDocument();
    await user.click(screen.getByText("Attachable"));
    expect(await screen.findByText("screen.png")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "View attachment screen.png" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "View attachment screen.png" }));
    expect(screen.getByRole("dialog", { name: "screen.png" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close attachment" }));

    const inputs = screen.getAllByLabelText("Choose attachment for Attachable");
    await user.upload(inputs.at(-1)!, new File([new Uint8Array([1, 2, 3])], "new-screen.png", { type: "image/png" }));
    expect(await screen.findByText("new-screen.png")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/features/31/attachments", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
  });

  it("removes the separate Specs workspace and returns old links to Features", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/specs");
    expect(await screen.findByRole("button", { name: "New feature" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Specs" })).not.toBeInTheDocument();
  });

  it("shows tracked people in Activity even when their workload is empty", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/feed/current");
    expect(await screen.findByText("JasperNoBoxDev")).toBeInTheDocument();
    expect(screen.getByText("0 open items")).toBeInTheDocument();
    expect(screen.queryByText("memenoboxdev")).not.toBeInTheDocument();
    expect(screen.queryByText("repo-guest")).not.toBeInTheDocument();
  });

  it("prefetches Activity data before a user selects another tab", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/feed/current");
    const merged = await screen.findByRole("link", { name: "Merged" });

    fireEvent.mouseEnter(merged);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/v1/feed?mode=merged&limit=20", expect.any(Object));
      expect(fetch).toHaveBeenCalledWith("/api/v1/feed?mode=release-notes", expect.any(Object));
    });
    expect(screen.getByRole("link", { name: "Current" })).toHaveClass("active");
  });

  it("opens a person's PRs, issues, and Planning features", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/v1/prs?")) return json({ data: [{ id: 1, repo: "playnist", number: 10, title: "Ship player", state: "open", author: "JasperNoBoxDev" }] });
      if (url.startsWith("/api/v1/issues?")) return json({ data: [{ id: 2, repo: "playnist", number: 11, title: "Fix player", state: "open", assignees: [{ login: "JasperNoBoxDev" }] }] });
      if (url.startsWith("/api/v1/features?state=all")) return json([{ id: 3, number: 12, title: "Player controls", state: "open", assignees: [{ login: "JasperNoBoxDev" }], labels: [] }]);
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/feed/current");
    expect(await screen.findByText("3 open items")).toBeInTheDocument();
    await user.click(screen.getByText("JasperNoBoxDev"));
    expect(await screen.findByRole("heading", { name: "JasperNoBoxDev" })).toBeInTheDocument();
    expect(screen.getByText("Ship player")).toBeInTheDocument();
    expect(screen.getByText("Fix player")).toBeInTheDocument();
    expect(screen.getByText("Player controls")).toBeInTheDocument();
  });

  it("renders merged activity without waiting for optional release notes", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/feed?mode=merged&limit=20") return json({ events: [{
        id: "merge-1", type: "merged", createdAt: "2026-09-27T00:00:00.000Z", repo: "playnist",
        summary: "Player controls shipped", technicalSummary: "Merged safely",
        actor: { login: "JasperNoBoxDev", name: "Jasper", avatarUrl: null },
        pr: { number: 42, title: "Ship player controls", url: "https://github.com/No-Box-Dev/playnist/pull/42" },
      }] });
      if (url === "/api/v1/feed?mode=release-notes") return new Promise<Response>(() => {});
      return baseFetch(input, init);
    });

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/feed/merged");
    expect(await screen.findByText("Player controls shipped")).toBeInTheDocument();
    expect(screen.queryByText("Loading activity")).not.toBeInTheDocument();
    expect(screen.getByText("Plain-English summary")).toBeInTheDocument();
    expect(screen.getByText("Merged safely")).toBeInTheDocument();
  });

  it("loads Opened activity in cursor pages on demand", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/feed?mode=opened&limit=20") return json({ events: [{
        id: "open-1", type: "opened", createdAt: "2026-09-27T00:00:00.000Z", repo: "playnist",
        summary: "First page", technicalSummary: "What it does: Adds a queue\nHow it works: Orders upcoming tracks\nWhat it touches: Player controls", actor: { login: "JasperNoBoxDev", name: "Jasper", avatarUrl: null },
        pr: { number: 43, title: "Add the player queue", url: "https://github.com/No-Box-Dev/playnist/pull/43" },
      }], nextCursor: "2026-09-27T00:00:00.000Z:1" });
      if (url.includes("mode=opened&limit=20&before=")) return json({ events: [{
        id: "open-2", type: "opened", createdAt: "2026-09-26T00:00:00.000Z", repo: "playnist",
        summary: "Second page", technicalSummary: "Second details", actor: { login: "JasperNoBoxDev", name: "Jasper", avatarUrl: null }, pr: null,
      }], nextCursor: null });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/feed/opened");
    expect(await screen.findByText("First page")).toBeInTheDocument();
    expect(screen.getByText("pr:opened")).toBeInTheDocument();
    expect(screen.getByText("Plain-English summary")).toBeInTheDocument();
    expect(screen.getByText("Adds a queue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add the player queue/ })).toHaveAttribute("href", "https://github.com/No-Box-Dev/playnist/pull/43");
    expect(screen.queryByText("Release notes")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("does not fan out service discovery across a large project list", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/v1/projects")) return json({ projects: Array.from({ length: 120 }, (_, index) => ({
        ...project,
        id: `proj_n1_${index}`,
        name: `N1 project ${index}`,
      })) });
      return baseFetch(input, init);
    });
    renderApp(<App />, "/n1healthcare/select/connect/overview");
    expect((await screen.findAllByText("N1 project 0")).length).toBeGreaterThan(0);
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === "/api/v1/services")).toHaveLength(0);
  });

  it("labels the active Feedback queue as Open", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/issues");
    expect(await screen.findByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Issues" })).not.toBeInTheDocument();
  });

  it("loads project capture widgets instead of showing a placeholder", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/widgets");
    expect(await screen.findByRole("heading", { name: "Capture widgets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Playnist" })).toBeInTheDocument();
    expect(screen.getByText(/api\.noxspot\.dev\/widget\/site-playnist\.js/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/spots/sites",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Org": "no-box-dev", "X-Project-ID": project.id }),
      }),
    );
  });

  it("filters the complete Feedback issue inbox by source", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/v1/spots/project-overview")) return json({ issues: [
        { number: 2000, repo: "playnist", title: "Widget report", source: "noxspot", reportStatus: "open", labels: [], author: { login: "reporter", avatarUrl: null }, contextSections: [], activity: [], notification: { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null } },
        { number: 2001, repo: "playnist", title: "Repository issue", source: "github", reportStatus: "open", labels: [], author: { login: "maintainer", avatarUrl: null }, contextSections: [], activity: [], notification: { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null } },
      ] });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/issues");
    expect(await screen.findByText("Widget report")).toBeInTheDocument();
    expect(screen.getByText("Repository issue")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Issue source" }), "github");
    expect(screen.queryByText("Widget report")).not.toBeInTheDocument();
    expect(screen.getByText("Repository issue")).toBeInTheDocument();
    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
  });

  it("renders rich Feedback capture details when the API supplies them", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/v1/spots/project-overview")) return json({ issues: [{
        id: "report-rich",
        number: 2000,
        repo: "playnist",
        title: "Rich feedback report",
        description: "The cover is not visible.",
        submittedBy: "Alex",
        internalReporter: { login: "alex", name: "Alex", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
        reportStatus: "open",
        screenshotUrl: "https://cdn.noxspot.dev/screenshots/report-rich.png",
        contextSections: [{ title: "Browser context", value: { browser: "Chromium" } }],
        author: null,
        labels: [],
        source: "noxspot",
        activity: [],
        notification: { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null },
        url: "https://github.com/No-Box-Dev/playnist/issues/2000",
      }] });
      return baseFetch(input, init);
    });

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/issues");
    const title = await screen.findByText("Rich feedback report");
    const report = title.closest("details");
    expect(report).not.toBeNull();
    expect(within(report!).getByRole("img", { name: "Screenshot attached to Rich feedback report" })).toHaveAttribute("src", "https://cdn.noxspot.dev/screenshots/report-rich.png");
    expect(report!.querySelector(".spot-report-avatar img")).toHaveAttribute("src", "https://avatars.githubusercontent.com/u/1");
    expect(within(report!).getByText("Browser context")).toBeInTheDocument();
    expect(within(report!).getByRole("link", { name: "Open GitHub issue ↗" })).toHaveAttribute("href", "https://github.com/No-Box-Dev/playnist/issues/2000");
  });

  it("loads Feedback in cursor pages on demand", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/spots/project-overview?view=open&limit=50") return json({ issues: [{
        number: 2000, repo: "playnist", title: "First feedback page", source: "noxspot", reportStatus: "open", labels: [], author: null, contextSections: [], activity: [], notification: { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null },
      }], nextCursor: "2026-09-27T00:00:00Z:2000" });
      if (url.includes("/api/v1/spots/project-overview?view=open&limit=50&before=")) return json({ issues: [{
        number: 1999, repo: "playnist", title: "Second feedback page", source: "github", reportStatus: "open", labels: [], author: null, contextSections: [], activity: [], notification: { eligible: false, status: "not_requested", attempts: 0, lastError: null, lastNotifiedAt: null },
      }], nextCursor: null });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/issues");
    expect(await screen.findByText("First feedback page")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second feedback page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("lets an admin brand and save the project's resolution email", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let savedTemplate = resolutionTemplate;
    let revision = "a".repeat(64);
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/spots/sites/site-playnist/resolution-template" && init?.method === "PATCH") {
        savedTemplate = JSON.parse(String(init.body)).template;
        revision = "b".repeat(64);
        return json({ template: savedTemplate, defaults: resolutionTemplate, usingDefault: true, revision });
      }
      if (url === "/api/v1/spots/sites/site-playnist/resolution-template") return json({ template: savedTemplate, defaults: resolutionTemplate, usingDefault: true, revision });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    const messagingView = renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/messaging");
    expect(await screen.findByRole("heading", { name: "Reporter messaging" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("#C62E07")).toBeInTheDocument();
    expect(screen.getByText("Playnist", { selector: ".email-card header" })).toBeInTheDocument();
    const sender = screen.getByRole("textbox", { name: "Sender name" });
    await user.clear(sender);
    await user.type(sender, "Playnist Support");
    await user.click(screen.getByRole("button", { name: "Save template" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/spots/sites/site-playnist/resolution-template", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ "If-Match": `"${"a".repeat(64)}"`, "X-Project-ID": project.id }),
      body: expect.stringContaining('"senderName":"Playnist Support"'),
    }));
    await waitFor(() => expect(savedTemplate.senderName).toBe("Playnist Support"));
    messagingView.unmount();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/spot/messaging");
    expect(await screen.findByDisplayValue("Playnist Support")).toBeInTheDocument();
  });

  it("scopes Incident requests to both the organization and project", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/cue/stats");
    expect(await screen.findByRole("button", { name: "Configure actions" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/projects/${project.id}/cue/dashboard?range=30d`,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Org": "no-box-dev", "X-Project-ID": project.id }),
      }),
    );
  });

  it("configures the three-action engagement template and provides tracking calls", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${project.id}/cue/actions` && init?.method === "PUT") {
        const actions = JSON.parse(String(init.body)).actions;
        return json({ projectId: project.id, windowDays: JSON.parse(String(init.body)).windowDays, actions: actions.map((action: { key: string; label: string }, index: number) => ({ ...action, slot: index + 1 })), snippet: "saved" });
      }
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/cue/stats");
    await user.click(await screen.findByRole("button", { name: "Configure actions" }));
    const dialog = await screen.findByRole("dialog", { name: "Engagement actions" });
    expect(within(dialog).getByDisplayValue("custom.comments.written")).toBeInTheDocument();
    expect(within(dialog).getByText(/noxCue\.activity\("custom\.comments\.written"/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Engagement timeframe" }), "14");
    await user.click(within(dialog).getByRole("button", { name: "Save actions" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/v1/projects/${project.id}/cue/actions`, expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining('"custom.reviews.written"'),
    })));
    expect(fetch).toHaveBeenCalledWith(`/api/v1/projects/${project.id}/cue/actions`, expect.objectContaining({ body: expect.stringContaining('"windowDays":14') }));
  });

  it("explains custom engagement with breadth and depth instead of a rolling average", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/cue/dashboard?range=30d")) return json({
        range: "30d", dateLabel: "2026-10-03", reportStatus: "Reported", stats: [{
          id: "custom.comments.written.per_mau", name: "Comments per active user", value: "5.00",
          context: "Last 7 days", change: "↑ 25.0% vs previous 7 days", direction: "up", points: [4, 5],
          breakdown: { actionLabel: "comments", windowDays: 7, totalActions: 100, activeUsers: 20, participatingUsers: 10, participationRate: 0.5, actionsPerParticipant: 10 },
        }],
      });
      return baseFetch(input, init);
    });

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/cue/stats");
    expect(await screen.findByText("Comments per active user")).toBeInTheDocument();
    expect(screen.getByText("5.00")).toBeInTheDocument();
    expect(document.querySelector(".stat-equation")).toHaveTextContent("100 comments ÷ 20 active users");
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("10.00")).toBeInTheDocument();
    expect(screen.getByText("↑ 25.0% vs previous 7 days")).toBeInTheDocument();
  });

  it("hands NoxKey management off to the separate app", async () => {
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/key/vault");
    expect(await screen.findByRole("heading", { name: "NoxKey is a separate secure app" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open NoxKey in the App Store" })).toHaveAttribute("href", "https://apps.apple.com/app/noxkey/id6760210699");
    expect(screen.getByRole("link", { name: "NoxKey" })).toBeInTheDocument();
  });

  it("uses actual project and collaborator responses in NoxConnect", async () => {
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/connect/overview");
    await user.click(await screen.findByRole("button", { name: "Toggle People and access" }));
    expect(await screen.findByText("JasperNoBoxDev")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle Connections" }));
    expect(screen.getAllByText(/No-Box-Dev\/nox-test-sandbox/).length).toBeGreaterThan(0);
  });

  it("shows every project capability as always available", async () => {
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/connect/overview");
    const toggle = await screen.findByRole("button", { name: "Toggle Capabilities" });
    await user.click(toggle);
    expect(screen.getByText("Always available")).toBeInTheDocument();
    expect(within(toggle.closest("details")!).getAllByText("Available")).toHaveLength(4);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes("/services/"))).toBe(false);
  });

  it("creates a project directly from the compact project picker", async () => {
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/connect/overview");
    await user.click(await screen.findByRole("button", { name: "Open project switcher" }));
    expect(screen.queryByText("Choose or edit a project")).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub.*No-Box-Dev/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ New project" }));
    expect(await screen.findByRole("checkbox", { name: "api" })).toBeChecked();
    await user.type(screen.getByRole("textbox", { name: "New project name" }), "Client portal");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/projects", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-Org": "no-box-dev" }),
      body: JSON.stringify({ name: "Client portal", repositories: ["api"] }),
    }));
  });

  it("edits the central project repository scope from Project Settings", async () => {
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/settings");

    await user.click(await screen.findByRole("checkbox", { name: /^api/ }));
    await user.click(screen.getByRole("button", { name: "Save repositories" }));

    expect(fetch).toHaveBeenCalledWith(`/api/v1/projects/${project.id}/routing`, expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        repositories: ["nox-test-sandbox", "api"],
        routes: {
          noxfeedPosts: { connectionId: "", channelId: "" },
          noxfeedReleaseNotes: { connectionId: "", channelId: "" },
          noxCue: { connectionId: "", channelId: "" },
          noxCueAlerts: { connectionId: "", channelId: "" },
        },
      }),
    }));
  });

  it("creates one guest invitation for all capabilities by default", async () => {
    const user = userEvent.setup();
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/connect/people");
    await user.click(await screen.findByRole("button", { name: "Invite guest" }));
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "guest@example.com");
    expect(screen.getByRole("combobox", { name: "Capability access" })).toHaveValue("all");
    await user.click(screen.getByRole("button", { name: "Send invite" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/guests/invites", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "guest@example.com", scopeType: "project", projectId: project.id, service: null }),
    }));
  });

  it("keeps guests inside their granted service and removes settings", async () => {
    const memberFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/me") return json({ login: "guest", org: "No-Box-Dev", isAdmin: false, accessLevel: "guest", allowedServices: ["noxspot"] });
      return memberFetch(input, init);
    });
    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/settings");
    expect(await screen.findByRole("link", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "NoxConnect" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "NoxKey" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/me", expect.objectContaining({
      headers: expect.objectContaining({ "X-Org": "no-box-dev", "X-Project-ID": project.id }),
    }));
  });

  it("lets an admin track members without changing their access", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    const boardStages = [{ id: "todo", label: "To do", color: "#94a3b8" }];
    let savedSettings: Record<string, unknown> = { excludedMembers: ["memenoboxdev"], boardStages };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/config/settings" && init?.method === "PUT") {
        savedSettings = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({ ok: true });
      }
      if (String(input) === "/api/v1/config/settings") return json(savedSettings);
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    const settingsView = renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/settings");
    expect(await screen.findByText("GitHub members can access every capability.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Track JasperNoBoxDev" })).toBeChecked();
    const memeTracking = screen.getByRole("switch", { name: "Track memenoboxdev" });
    expect(memeTracking).not.toBeChecked();
    await user.click(memeTracking);
    expect(fetch).toHaveBeenCalledWith("/api/v1/config/settings", expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ "X-Org": "no-box-dev", "X-Project-ID": project.id }),
      body: JSON.stringify({ excludedMembers: [], boardStages }),
    }));
    await waitFor(() => expect(savedSettings).toMatchObject({ excludedMembers: [], boardStages }));
    settingsView.unmount();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/settings");
    expect(await screen.findByRole("switch", { name: "Track memenoboxdev" })).toBeChecked();
  });

  it("configures the Planning feature alert channel", async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation()!;
    let savedChannel: string | null = null;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/integrations/slack/routing" && init?.method === "PATCH") {
        savedChannel = JSON.parse(String(init.body)).routes.noxticket;
        return json({ routes: { noxticket: savedChannel }, connections: { noxticket: savedChannel ? "conn-1" : null } });
      }
      if (String(input) === "/api/v1/integrations/slack/routing") return json({ routes: { noxticket: savedChannel }, connections: { noxticket: savedChannel ? "conn-1" : null } });
      return baseFetch(input, init);
    });
    const user = userEvent.setup();
    const planningSettings = renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/settings");
    const channel = await screen.findByRole("combobox", { name: "Planning feature alert channel" });
    await screen.findByRole("option", { name: "#feature-alerts" });
    await user.selectOptions(channel, "C-FEATURES");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(fetch).toHaveBeenCalledWith("/api/v1/integrations/slack/routing", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({ "X-Org": "no-box-dev", "X-Project-ID": project.id }),
      body: JSON.stringify({ routes: { noxticket: "C-FEATURES" }, connections: { noxticket: "conn-1" } }),
    }));
    expect(await screen.findByText("Feature alerts are on.")).toBeInTheDocument();
    planningSettings.unmount();

    renderApp(<App />, "/no-box-dev/proj_no-box-dev_playnist/ticket/settings");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Planning feature alert channel" })).toHaveValue("C-FEATURES"));
  });
});
