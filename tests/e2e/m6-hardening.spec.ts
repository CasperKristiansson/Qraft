import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page, path = "/") {
  await page.goto(path);
  await page.request.post("/__qraft-example/recreate");
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

function luminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/giu)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

test("M6 reduced motion, contrast, live status, focus containment, and narrow layout remain accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 768, height: 900 });
  await reset(page);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Qraft" })).toBeFocused();
  expect(await drawer.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect(drawer.getByRole("progressbar")).toHaveAttribute("aria-label", /tasks passed/u);

  const colors = await drawer.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      body: style.color.match(/\d+/gu)?.slice(0, 3).map(Number) ?? [],
      background: style.backgroundColor.match(/\d+/gu)?.slice(0, 3).map(Number) ?? [],
      accent: style.getPropertyValue("--qraft-purple").trim(),
    };
  });
  const hex = (rgb: number[]) => `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  expect(contrast(hex(colors.body), hex(colors.background))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);

  await drawer.getByRole("button", { name: "Add section" }).click();
  await drawer.getByLabel("Title").fill("Accessibility");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("status")).toContainText("Section saved to QA.md.");

  await page.keyboard.press("Shift+Tab");
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
  await drawer.getByRole("button", { name: "Change quantity" }).click();
  await drawer.getByRole("button", { name: "Finding" }).click();
  await drawer.getByLabel("Details").fill("Keep this draft after a failed write.");

  await page.getByRole("button", { name: "Fail next write" }).click();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("alert")).toContainText("original was left unchanged");
  await expect(drawer.getByLabel("Details")).toHaveValue("Keep this draft after a failed write.");
});
