import { expect, type Page } from "@playwright/test";

export const drawer = (page: Page) => page.getByRole("dialog");
export const taskButton = (page: Page, title: string) =>
  drawer(page).locator(".qraft-task").filter({ hasText: title });
export async function open(page: Page) {
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await expect(drawer(page)).toBeVisible();
}
export async function reset(page: Page, path = "/") {
  await page.goto(path);
  await page.request.post("/__qraft-example/recreate");
  await page.reload();
  await open(page);
  if (!path.includes("protocol")) {
    await expect(
      drawer(page)
        .getByRole("heading", { name: "Choose a checklist", exact: true })
        .or(taskButton(page, "Change quantity")),
    ).toBeVisible();
    if (
      await drawer(page)
        .getByRole("heading", { name: "Choose a checklist", exact: true })
        .isVisible()
    )
      await drawer(page).getByRole("button", { name: "QA.local.md", exact: true }).click();
  }
  await expect(taskButton(page, "Change quantity")).toBeVisible();
}
