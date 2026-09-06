import { reset } from "./helpers";
import { expect, test } from "@playwright/test";

function luminance(hex: string) {
  const channels =
    hex.match(/[\da-f]{2}/giu)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

test("M6 reduced motion, contrast, live status, focus containment, and narrow layout remain accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 768, height: 900 });
  await reset(page);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Qraft" })).toBeFocused();
  expect(await drawer.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect(drawer.getByRole("progressbar")).toHaveAttribute("aria-label", /tasks completed/u);

  const colors = await drawer.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      body: style.color.match(/\d+/gu)?.slice(0, 3).map(Number) ?? [],
      background: style.backgroundColor.match(/\d+/gu)?.slice(0, 3).map(Number) ?? [],
      accent: style.getPropertyValue("--qraft-purple").trim(),
    };
  });
  const hex = (rgb: number[]) =>
    `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  expect(contrast(hex(colors.body), hex(colors.background))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);

  await drawer.getByRole("button", { name: "Add section" }).click();
  await drawer.getByLabel("Title").fill("Accessibility");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("status")).toContainText("Section saved.");

  await drawer.getByRole("button", { name: "Close Qraft", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "Close Qraft", exact: true })).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("visible");
  const focusIsInsideQraft = await page.evaluate(() => {
    const root = document.querySelector("[data-qraft-root]")?.shadowRoot;
    return Boolean(root?.activeElement && root.activeElement !== root.host);
  });
  expect(focusIsInsideQraft).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
});

test("M6 filesystem failure is recoverable and preserves the unsaved draft", async ({ page }) => {
  await reset(page, "/?protocol=1");
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Change quantity", exact: true }).click();
  await drawer.getByLabel("Write a note").fill("Keep this draft after a failed write.");

  await page.getByRole("button", { name: "Fail next write" }).click();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await drawer.getByRole("button", { name: "Submit" }).click();
  await expect(drawer.getByRole("alert")).toContainText("Review the latest file before retrying");
  await expect(drawer.getByLabel("Write a note")).toHaveValue(
    "Keep this draft after a failed write.",
  );
  await page.request.post("/__qraft-example/restore-writes");
  await drawer.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    drawer.getByText("Keep this draft after a failed write.", { exact: true }),
  ).toBeVisible();
});

test("legacy task retains selection after its first note and status change", async ({ page }) => {
  await reset(page, "/?protocol=1");
  await page.request.post("/__qraft-example/legacy");
  await page.reload();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Legacy task", exact: true }).click();
  await drawer.getByLabel("Write a note").fill("First mutation");
  await drawer.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(drawer.getByRole("heading", { name: "Legacy task", exact: true })).toBeVisible();
  await expect(drawer.getByLabel("Write a note")).toHaveValue("");
  await expect(drawer.locator(".qraft-detail-heading .qraft-status")).toBeEnabled();
  await drawer
    .getByRole("button", { name: "Legacy task: Not completed. Change status", exact: true })
    .press("Enter");
  await expect(
    drawer.getByRole("button", { name: "Legacy task: Completed. Change status", exact: true }),
  ).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Legacy task", exact: true })).toBeVisible();
});

test("M6 disconnected stream reconnects and refetches while preserving a draft", async ({
  page,
}) => {
  await page.route("**/__qraft/**/events", (route) => route.abort());
  await reset(page);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Add section", exact: true }).click();
  await drawer.getByLabel("Title").fill("Reconnect draft");
  await expect(drawer.getByText(/Disconnected/u)).toBeVisible();
  await page.request.post("/__qraft-example/external-edit");
  const response = await page.request.get("/__qraft/document");
  const latest = await response.json();
  const refreshed = page.waitForResponse(
    async (response) =>
      /\/__qraft\/.*\/document$/u.test(response.url()) &&
      response.request().method() === "GET" &&
      (await response.json()).revision === latest.revision,
  );
  await page.unroute("**/__qraft/**/events");
  await expect(drawer.getByText(/Disconnected/u)).toHaveCount(0);
  await expect(drawer.getByLabel("Title")).toHaveValue("Reconnect draft");
  await refreshed;
  await drawer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    drawer.getByRole("heading", { name: "Reconnect draft 0", exact: true }),
  ).toBeVisible();
});
