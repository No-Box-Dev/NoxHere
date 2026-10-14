import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokens } from "./ApiTokens";

describe("ApiTokens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      tokens: [
        {
          id: "active", name: "Production writer", environment: "production",
          projectId: "project-1", projectName: "NoxHere", prefix: "nox_sk_live_example",
          scopes: ["telemetry:ingest", "slack:send"], createdAt: "2026-10-01T00:00:00Z",
          expiresAt: "2026-12-01T00:00:00Z", lastUsedAt: "2026-10-14T12:00:00Z", revokedAt: null,
        },
        {
          id: "revoked", name: "Previous writer", environment: "production",
          projectId: "project-1", projectName: "NoxHere", prefix: "nox_sk_live_previous",
          scopes: ["telemetry:ingest"], createdAt: "2026-09-01T00:00:00Z",
          expiresAt: "2026-11-01T00:00:00Z", lastUsedAt: null, revokedAt: "2026-10-13T12:00:00Z",
        },
      ],
    }), { headers: { "Content-Type": "application/json" } })));
  });

  it("shows usage and revoked lifecycle metadata without exposing secrets", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ApiTokens organizationId="7" projectId="project-1" projectName="NoxHere" isAdmin /></QueryClientProvider>);

    expect(await screen.findByText("Production writer")).toBeInTheDocument();
    expect(screen.getByText(/Last used/)).toBeInTheDocument();
    expect(screen.getByText("Credential history")).toBeInTheDocument();
    expect(screen.getByText("Previous writer")).toBeInTheDocument();
    expect(screen.getByText(/Never used/)).toBeInTheDocument();
    expect(screen.queryByText(/nox_sk_live_example_secret_value/)).not.toBeInTheDocument();
  });
});
