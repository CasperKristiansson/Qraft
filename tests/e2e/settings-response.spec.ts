import { expect, test } from "@playwright/test";
import { drawer, reset, taskButton } from "./helpers";

test("status responds before saving and keeps the list steady on failure", async ({ page }) => {
  await reset(page);
  const row = drawer(page).locator(".qraft-task-row").filter({ hasText: "Change quantity" });
  const status = row.locator(".qraft-status");
  const before = await row.boundingBox();
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/commands", async (route) => {
    await response;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "write_failed", message: "Test save failed. Retry." },
      }),
    });
  });
  // Inspect the next rendered frame, before the double-click window expires.
  await status.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(await status.getAttribute("class")).toContain("completed");
  await expect(status).toBeDisabled();
  expect(
    await taskButton(page, "Change quantity").evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("1");
  expect(await row.boundingBox()).toEqual(before);
  release();
  await expect(status).toBeEnabled();
  await expect(status).toHaveClass(/open/u);
  await expect(drawer(page).getByRole("alert")).toContainText("Test save failed");
});

test("settings replaces the checklist and returns without losing a note draft", async ({
  page,
}) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("Keep this observation");
  await drawer(page).getByRole("button", { name: "Back to checklist", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer(page).getByRole("heading", { name: "Settings", exact: true })).toBeFocused();
  await expect(taskButton(page, "Change quantity")).toHaveCount(0);
  await expect(drawer(page).getByRole("button", { name: "Add section", exact: true })).toHaveCount(
    0,
  );
  await expect(drawer(page).getByRole("progressbar")).toHaveCount(0);
  for (const name of ["Layout", "Saved session", "Visibility"]) {
    await expect(drawer(page).getByRole("region", { name, exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 360, height: 640 });
  await drawer(page).getByRole("button", { name: "Clear saved session…", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    drawer(page).getByRole("button", { name: "Clear saved session…", exact: true }),
  ).toBeFocused();
  expect(await drawer(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await drawer(page).getByRole("button", { name: "Back to checklist", exact: true }).click();
  await taskButton(page, "Change quantity").click();
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Keep this observation",
  );
});

test("double-click saves skipped once and status cycles keep fixed row geometry", async ({
  page,
}) => {
  await reset(page);
  const row = drawer(page).locator(".qraft-task-row").filter({ hasText: "Change quantity" });
  const status = row.locator(".qraft-status");
  const bounds = await row.boundingBox();
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/commands")) writes.push(request.postDataJSON().command.status);
  });
  await status.dblclick();
  await expect(status).toHaveClass(/skipped/u);
  await expect(status).toBeEnabled();
  await expect(status).not.toHaveAttribute("aria-busy", "true");
  expect(writes).toEqual(["skipped"]);
  expect(await row.boundingBox()).toEqual(bounds);
  await status.press("Space");
  await expect(status).toHaveClass(/open/u);
  await expect(status).toBeEnabled();
  await status.press("Enter");
  await expect(status).toHaveClass(/completed/u);
  await expect(status).toBeEnabled();
  await expect(status).not.toHaveAttribute("aria-busy", "true");
  expect(writes).toEqual(["skipped", "open", "completed"]);
  await expect(status).toBeFocused();
  expect(await row.boundingBox()).toEqual(bounds);
});
