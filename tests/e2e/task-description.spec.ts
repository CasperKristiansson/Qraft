import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { drawer, open, reset, taskButton } from "./helpers";

const local = resolve("examples/vite-react/QA.local.md");

test("task descriptions survive draft reload and failed saves, independently of feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reset(page);
  const d = drawer(page);
  const before = await readFile(local, "utf8");
  await d.getByRole("button", { name: "Add task", exact: true }).last().click();
  await d.getByLabel("Title", { exact: true }).fill("Review cart totals");
  const description = d.getByLabel("Description (optional)", { exact: true });
  await description.fill("Use two items.");
  await description.press("End");
  await description.press("Enter");
  await expect(description).toHaveValue("Use two items.\n");
  await description.fill("Use two items.\nThe total should follow quantity.");
  expect(await readFile(local, "utf8")).toBe(before);

  await page.reload();
  await open(page);
  await expect(d.getByLabel("Title", { exact: true })).toHaveValue("Review cart totals");
  await expect(description).toHaveValue("Use two items.\nThe total should follow quantity.");
  await page.route("**/__qraft/**/commands", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "write_failed", message: "Fixture save failure", retryable: true },
      }),
    }),
  );
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Fixture save failure");
  await expect(description).toHaveValue("Use two items.\nThe total should follow quantity.");
  expect(await readFile(local, "utf8")).toBe(before);
  await page.unroute("**/__qraft/**/commands");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(taskButton(page, "Review cart totals")).toBeVisible();
  const written = await readFile(local, "utf8");
  const id = written.match(/- \[ \] Review cart totals <!-- qraft:id=(task_[^ ]+) -->/u)?.[1];
  expect(id).toBeTruthy();
  expect(written).toBe(
    before +
      `- [ ] Review cart totals <!-- qraft:id=${id} -->\n  Use two items.\n  The total should follow quantity.\n`,
  );
  await taskButton(page, "Review cart totals").click();
  await expect(d.getByRole("region", { name: "Description", exact: true })).toContainText(
    "The total should follow quantity.",
  );
  await expect(d.getByRole("heading", { name: "Notes · 0", exact: true })).toBeVisible();
  await d.getByLabel("Write a note", { exact: true }).fill("The total does not update.");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(d.getByRole("heading", { name: "Notes · 1", exact: true })).toBeVisible();
  await expect(d.getByRole("region", { name: "Description", exact: true })).toContainText(
    "The total should follow quantity.",
  );
  await d.getByRole("button", { name: "Back to checklist", exact: true }).click();
  await taskButton(page, "Remove product").click();
  await expect(d.getByRole("region", { name: "Description", exact: true })).toHaveCount(0);
});
