import { expect, test } from "@playwright/test";
import { drawer, open, reset, taskButton } from "./helpers";

async function enable(page: Parameters<typeof reset>[0]) {
  await drawer(page).getByRole("button", { name: "Settings", exact: true }).click();
  await drawer(page).getByLabel("Push page content", { exact: true }).check();
}

const pageWidth = (page: Parameters<typeof reset>[0]) =>
  page.getByTestId("host-layout").evaluate((element) => element.getBoundingClientRect().width);

const padding = (page: Parameters<typeof reset>[0]) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).paddingRight));

test("page space uses drawer width, keeps host usable, and restores existing root styles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reset(page);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("padding-right", "12px", "important");
    document.documentElement.style.setProperty("--host-owned", "keep");
  });
  const before = await pageWidth(page);
  await enable(page);
  const width = (await drawer(page).boundingBox())!.width;
  await expect.poll(() => pageWidth(page)).toBeCloseTo(before - width, 0);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByTestId("quantity-value")).toHaveText("3");
  await drawer(page).getByLabel("Push page content", { exact: true }).uncheck();
  await expect.poll(() => pageWidth(page)).toBeCloseTo(before, 0);
  expect(
    await page.evaluate(() => ({
      padding: document.documentElement.style.getPropertyValue("padding-right"),
      priority: document.documentElement.style.getPropertyPriority("padding-right"),
      width: document.documentElement.style.width,
      box: document.documentElement.style.boxSizing,
      host: document.documentElement.style.getPropertyValue("--host-owned"),
    })),
  ).toEqual({ padding: "12px", priority: "important", width: "", box: "", host: "keep" });
});

test("page space survives reload, preserves picker layout, and releases space on close and narrow resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reset(page);
  await enable(page);
  await drawer(page).getByRole("button", { name: "Back to checklist", exact: true }).click();
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("Keep the resized context");
  const width = await pageWidth(page);
  await drawer(page).getByRole("button", { name: "Attach element", exact: true }).click();
  await expect.poll(() => pageWidth(page)).toBe(width);
  await page.keyboard.press("Escape");
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Keep the resized context",
  );
  await drawer(page).getByRole("button", { name: "Close Qraft", exact: true }).click();
  await expect.poll(() => padding(page)).toBe(0);
  await expect(drawer(page)).toHaveCount(0);
  await open(page);
  await expect.poll(() => pageWidth(page)).toBe(width);
  await page.reload();
  await open(page);
  await expect.poll(() => pageWidth(page)).toBe(width);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => padding(page)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 1366, height: 650 });
  await expect.poll(() => padding(page)).toBe(380);
  await drawer(page).getByRole("button", { name: "Back to checklist", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer(page).getByLabel("Push page content", { exact: true })).toBeChecked();
  await drawer(page).getByRole("button", { name: "Hide Qraft until reload", exact: true }).click();
  await expect.poll(() => padding(page)).toBe(0);
});

test("unmount restores owned styles and preserves host changes made during review", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reset(page, "/?layout");
  await enable(page);
  await expect.poll(() => padding(page)).toBe(380);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("width", "95%", "important");
  });
  await page.getByRole("button", { name: "Unmount Qraft", exact: true }).click();
  await expect(drawer(page)).toHaveCount(0);
  await expect.poll(() => padding(page)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.style.width)).toBe("95%");
  expect(await page.evaluate(() => document.documentElement.style.boxSizing)).toBe("");
});
