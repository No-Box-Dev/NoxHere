import { expect, test } from "@playwright/test";

const widgetCore = "../../packages/feedback-widget/dist/feedback-core.min.js";
const liveTestUrl = "https://app.noxhere.com/__feedback-widget-browser-test";
const noxHereSiteId = "8970ca4d-75ad-41d0-a5fa-e4e62e658635";

const hostPage = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Feedback widget browser test</title></head>
  <body>
    <main>
      <h1>Feedback widget browser test</h1>
      <button id="target">Element picker target</button>
    </main>
  </body>
</html>`;

async function exercisePickerCleanup(page: import("@playwright/test").Page) {
  const overlay = page.locator(".feedback-overlay");
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => {
    const screenshot = await overlay.locator(".feedback-screenshot").getAttribute("src");
    const fallback = await overlay.getByText("Screenshot unavailable", { exact: true }).count();
    return Boolean(screenshot?.startsWith("data:image/") || fallback);
  }, { timeout: 15_000 }).toBe(true);

  const picker = overlay.locator('[data-tool="element"]');
  await picker.click();
  await picker.click();
  await expect(page.locator(".feedback-picker-instruction")).toHaveCount(0);

  await overlay.getByRole("button", { name: "Close" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".feedback-picker-instruction")).toHaveCount(0);
}

test("removes the element-picker coachmark when the local widget closes", async ({ page }) => {
  await page.setContent(hostPage);
  await page.addScriptTag({ path: widgetCore });
  await page.evaluate(() => {
    const state = window as typeof window & { __FeedbackCore: { open(input: unknown): void } };
    state.__FeedbackCore.open({
      mode: "click",
      callbacks: {
        blocks: [{ id: "element", type: "element_picker", required: false }],
        onClose: () => {},
        onSubmit: () => {},
      },
    });
  });

  await exercisePickerCleanup(page);
});

test("removes the element-picker coachmark from the live production loader", async ({ page }) => {
  test.skip(process.env.LIVE_WIDGET_E2E !== "1", "Set LIVE_WIDGET_E2E=1 to exercise production assets");
  await page.route(liveTestUrl, (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: hostPage.replace("</body>", `<script src="/widget/${noxHereSiteId}.js"></script></body>`),
  }));
  await page.goto(liveTestUrl);

  const trigger = page.locator(".feedback-trigger");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  await exercisePickerCleanup(page);
});
