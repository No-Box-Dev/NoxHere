import { expect, test } from "@playwright/test";

test("opens the main Playnist view", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/no-box-dev\/proj_no-box-dev_playnist\/connect\/overview$/);
  await expect(page.getByRole("button", { name: "Open project switcher" })).toContainText("playnist", { timeout: 30_000 });
  await expect(page.getByText("No-Box-Dev/playnist · repository data, issues and pull requests")).toBeVisible({ timeout: 30_000 });
});

test("keeps administration in Settings and NoxConnect last", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/connect/overview");
  await expect(page.getByText("API access", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Maintenance", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Projects belong to NoxConnect", { exact: true })).toHaveCount(0);
  const productLinks = page.locator(".service-nav a");
  await expect(productLinks.last()).toHaveText("NoxConnect");
  await page.getByRole("link", { name: /settings/i }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("API access", { exact: true })).toBeVisible();
  await expect(page.getByText("Maintenance", { exact: true })).toBeVisible();
  await expect(page.getByText("Projects belong to NoxConnect", { exact: true })).toBeVisible();
});

test("collapses the capability sidebar and remembers the preference", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/feed/current");
  const nav = page.locator(".service-nav");
  await expect(nav.locator("a").last()).toHaveAccessibleName("NoxConnect");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".platform")).toHaveClass(/sidebar-collapsed/);
  await expect(nav.locator(".service-icon").first()).toBeVisible();
  await page.reload();
  await expect(page.locator(".platform")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".service-nav a").last()).toHaveAccessibleName("NoxConnect");
});

test("shows the real project catalog without Test Project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open project switcher" }).click({ timeout: 30_000 });
  await expect(page.locator(".project-option")).toHaveCount(30);
  await expect(page.getByRole("button", { name: "NoxHere", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "NoxTicket", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New project", exact: true })).toBeVisible();
  await expect(page.getByText("Test Project", { exact: true })).toHaveCount(0);
});

test("switches between actual projects", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open project switcher" }).click();
  await page.getByRole("button", { name: /NoxHere/ }).first().click();
  await expect(page).toHaveURL(/\/proj_no-box-dev_noxhere\/connect\/overview$/);
  await expect(page.getByRole("button", { name: "Open project switcher" })).toContainText("NoxHere");
});

test("keeps the empty NoxTicket board usable", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/ticket/board");
  await expect(page.getByRole("link", { name: "Features", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("To do", { exact: true })).toBeVisible();
  await expect(page.getByText("On production", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New feature", exact: true })).toBeEnabled();
  await expect(page.getByText("Verify the NoxTicket board workflow", { exact: true })).toHaveCount(0);
});

const serviceRoutes = [
  ["/no-box-dev/proj_no-box-dev_playnist/ticket/board", "Features"],
  ["/no-box-dev/proj_no-box-dev_playnist/ticket/backlog", "Backlog"],
  ["/no-box-dev/proj_no-box-dev_playnist/ticket/completed", "Completed"],
  ["/no-box-dev/proj_no-box-dev_playnist/ticket/settings", "Settings"],
  ["/no-box-dev/proj_no-box-dev_playnist/feed/current", "Current"],
  ["/no-box-dev/proj_no-box-dev_playnist/feed/opened", "Opened"],
  ["/no-box-dev/proj_no-box-dev_playnist/feed/merged", "Merged"],
  ["/no-box-dev/proj_no-box-dev_playnist/feed/issues", "Issues"],
  ["/no-box-dev/proj_no-box-dev_playnist/spot/issues", "Open"],
  ["/no-box-dev/proj_no-box-dev_playnist/spot/resolved", "Resolved"],
  ["/no-box-dev/proj_no-box-dev_playnist/spot/widgets", "Widgets"],
  ["/no-box-dev/proj_no-box-dev_playnist/spot/messaging", "Messaging"],
  ["/no-box-dev/proj_no-box-dev_playnist/cue/stats", "Stats"],
  ["/no-box-dev/proj_no-box-dev_playnist/cue/alerts", "Alerts"],
] as const;

test("opens every service tab without a page failure", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const [path, activeTab] of serviceRoutes) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: activeTab, exact: true })).toHaveClass(/active/, { timeout: 30_000 });
    await expect(page.getByText("Could not load this view", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Request failed with status (401|403|500)/)).toHaveCount(0);
  }
  expect(pageErrors).toEqual([]);
});

test("opens NoxKey and its real download action", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/key/vault");
  await expect(page.getByText("Organization secrets are coming soon", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Download NoxKey", exact: true })).toHaveAttribute("href", /apps\.apple\.com/);
});

test("opens each NoxConnect section and project settings controls", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/connect/overview");
  for (const section of ["Connections", "People and access", "Repositories", "Capabilities"]) {
    const toggle = page.getByRole("button", { name: `Toggle ${section}` });
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  const capabilities = page.locator(".connect-accordion").filter({ has: page.getByRole("button", { name: "Toggle Capabilities" }) });
  await expect(capabilities.getByText("Planning", { exact: true })).toBeVisible();
  await expect(capabilities.getByText("Activity", { exact: true })).toBeVisible();
  await expect(capabilities.getByText("Feedback", { exact: true })).toBeVisible();
  await expect(capabilities.getByText("Incidents", { exact: true })).toBeVisible();
  await expect(capabilities.getByText("Available", { exact: true })).toHaveCount(4);

  await page.getByRole("link", { name: /settings/i }).click();
  await expect(page.getByText("Members", { exact: true })).toBeVisible();
  await expect(page.getByText("API access", { exact: true })).toBeVisible();
  await expect(page.getByText("Maintenance", { exact: true })).toBeVisible();
});

test("shows Playnist merged work with its real release notes", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/feed/merged");
  const latest = page.locator(".feed-post-card").first();
  await expect(latest).toContainText("Refine collection previews and review cards", { timeout: 30_000 });
  await expect(latest.locator(".feed-post-author > b")).toHaveText("JasperNoBoxDev");
  await expect(latest.locator(".feed-post-pills")).toContainText("playnist");
  await expect(latest.locator(".feed-post-pills")).toContainText("pr:merged");
  await expect(latest.locator(".feed-post-body")).toContainText("Polished up how collection previews and review cards render");
  await expect(latest.getByRole("link", { name: "Refine collection previews and review cards" })).toHaveAttribute("href", /github\.com\/No-Box-Dev\/playnist\/pull\//);
  await latest.locator(".feed-release-note summary").click();
  await expect(latest).toContainText("Outcome:");
});

test("expands a real NoxSpot report with its screenshot and captured context", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/spot/issues");
  await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 30_000 });
  const refreshed = page.waitForResponse((response) => response.url().includes("/api/v1/spots/project-overview") && response.ok());
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await refreshed;
  await expect(page.getByText("Updated just now", { exact: true })).toBeVisible();
  const report = page.locator(".spot-report").filter({ hasText: "cover gone" });
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report.locator(".spot-report-avatar img")).toHaveAttribute("src", /avatars\.githubusercontent\.com/);
  await expect(report.locator(".spot-report-avatar")).not.toContainText("!");
  await report.locator(":scope > summary").click();
  await expect(report.locator(".spot-report-image img")).toHaveAttribute("src", /cdn\.noxspot\.dev\/screenshots\//);
  await expect(report.locator(".spot-report-copy")).toContainText("the cover of this game is not visible");
  await expect(report.locator(".spot-context")).toContainText("Browser context");
  await expect(report.getByRole("link", { name: "Open GitHub issue" })).toHaveAttribute("href", /github\.com\/No-Box-Dev\/playnist\/issues\/2000/);
});

test("shows the mirrored Playnist stats dashboard", async ({ page }) => {
  await page.goto("/no-box-dev/proj_no-box-dev_playnist/cue/stats");
  await expect(page.getByText("Total users", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Daily active users", { exact: true })).toBeVisible();
  await expect(page.getByText("Reported", { exact: true })).toBeVisible();
});
