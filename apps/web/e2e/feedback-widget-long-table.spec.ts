import { expect, test } from "@playwright/test";

const widgetCore = "../../packages/feedback-widget/dist/noxspot-core.min.js";

test("stays responsive and submits feedback on a long data table", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setContent("<main><table><tbody id='rows'></tbody></table></main>");
  await page.evaluate(() => {
    const body = document.querySelector("#rows");
    const fragment = document.createDocumentFragment();
    for (let rowIndex = 0; rowIndex < 2_500; rowIndex += 1) {
      const row = document.createElement("tr");
      row.dataset.rowId = String(rowIndex);
      for (let column = 0; column < 8; column += 1) {
        const cell = document.createElement("td");
        cell.textContent = `Row ${rowIndex}, column ${column}`;
        row.appendChild(cell);
      }
      fragment.appendChild(row);
    }
    body?.appendChild(fragment);
  });
  await page.addScriptTag({ path: widgetCore });

  await page.evaluate(() => {
    const state = window as typeof window & {
      __NoxSpotCore: { open(input: unknown): void };
      __captureErrors?: number;
      __submittedFeedback?: unknown;
    };
    state.__captureErrors = 0;
    state.__NoxSpotCore.open({
      mode: "click",
      callbacks: {
        blocks: [
          { id: "title", type: "title", required: true },
          { id: "description", type: "description", required: false },
          { id: "element", type: "element_picker", required: false },
        ],
        onClose: () => {},
        onCaptureError: () => { state.__captureErrors = (state.__captureErrors ?? 0) + 1; },
        onSubmit: (payload: unknown) => { state.__submittedFeedback = payload; },
      },
    });
  });

  const overlay = page.locator(".noxspot-overlay");
  await expect(overlay).toBeVisible();
  await expect.poll(async () => {
    const screenshot = await overlay.locator(".noxspot-screenshot").getAttribute("src");
    const fallback = await overlay.getByText("Screenshot unavailable", { exact: true }).count();
    return Boolean(screenshot?.startsWith("data:image/") || fallback);
  }, { timeout: 10_000 }).toBe(true);
  await overlay.locator("#noxspot-title").fill("Long table feedback");
  await overlay.getByRole("button", { name: "Submit" }).click();

  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { __submittedFeedback?: unknown }).__submittedFeedback))).toBe(true);
  const result = await page.evaluate(() => {
    const state = window as typeof window & {
      __captureErrors?: number;
      __submittedFeedback?: { screenshot?: string | null };
    };
    return {
      captureErrors: state.__captureErrors ?? 0,
      screenshot: state.__submittedFeedback?.screenshot ?? null,
    };
  });
  expect(result.captureErrors).toBeLessThanOrEqual(1);
  expect(result.screenshot === null || result.screenshot.startsWith("data:image/")).toBe(true);
});
