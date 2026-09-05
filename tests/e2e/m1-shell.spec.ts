import { expect, test } from "@playwright/test";

test("M1 shadow drawer overlays the host and supports keyboard close", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.request.post("/__qraft-example/recreate");
  await page.waitForTimeout(900);
  await page.reload();
  const before = await page.getByTestId("host-layout").boundingBox();
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  const drawer = page.locator("[data-qraft-root]").locator("[role=dialog]");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Checkout QA")).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Qraft" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  expect(await page.getByTestId("host-layout").boundingBox()).toEqual(before);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(scrollBefore);
  await expect(page.getByRole("button", { name: /Open Qraft/u })).toBeFocused();
});
