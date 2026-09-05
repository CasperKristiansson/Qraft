import { expect, test } from "@playwright/test";
import { drawer, open, reset, taskButton } from "./helpers";

test("review states change from list and detail independently of notes without auto-advance", async ({
  page,
}) => {
  await reset(page);
  const d = drawer(page);
  const marker = () => d.getByRole("button", { name: /^Change quantity: /u });
  await marker().click();
  await expect(marker()).toHaveAccessibleName(/Completed/u);
  await marker().click();
  await expect(marker()).toHaveAccessibleName(/Skipped/u);
  await marker().click();
  await expect(marker()).toHaveAccessibleName(/Not completed/u);
  await marker().dblclick();
  await expect(marker()).toHaveAccessibleName(/Skipped/u);
  await taskButton(page, "Change quantity").click();
  await expect(d.getByRole("progressbar")).toHaveCount(0);
  await d.getByLabel("Write a note").fill("Center the button.");
  await d.getByLabel("Write a note").press("Enter");
  await expect(d.getByText("Center the button.", { exact: true })).toBeVisible();
  await d.getByLabel("Write a note").fill("Improve the spacing.");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(d.getByText("Improve the spacing.", { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(d.getByRole("button", { name: "Completed", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(d.getByRole("heading", { name: "Change quantity", exact: true })).toBeVisible();
  await expect(d.getByText("Checklist complete", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "Back to checklist", exact: true }).click();
  await expect(taskButton(page, "Change quantity")).toContainText("2 notes");
});

test("notes edit independently and drafts survive navigation, picker cancellation and external refresh", async ({
  page,
}) => {
  await reset(page);
  const d = drawer(page);
  await taskButton(page, "Change quantity").click();
  const input = d.getByLabel("Write a note");
  await input.fill("First note");
  await input.press("Enter");
  await expect(d.getByText("First note", { exact: true })).toBeVisible();
  await input.fill("Unsubmitted second note");
  await d.getByRole("button", { name: "Edit note: First note", exact: true }).click();
  await d.getByLabel("Edit note", { exact: true }).fill("Edited first note");
  await d.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(d.getByText("Edited first note", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("Unsubmitted second note");
  await d.getByRole("button", { name: "Back to checklist", exact: true }).click();
  await taskButton(page, "Change quantity").click();
  await expect(input).toHaveValue("Unsubmitted second note");
  await d.getByRole("button", { name: "Attach element", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("Unsubmitted second note");
  await expect(input).toBeFocused();
  const refreshed = page.waitForResponse(
    (response) =>
      /\/__qraft\/.*\/document$/u.test(response.url()) && response.request().method() === "GET",
  );
  await page.request.post("/__qraft-example/external-edit");
  const latest = await page.request.get("/__qraft/document").then((r) => r.json());
  expect((await (await refreshed).json()).revision).toBe(latest.revision);
  await expect(input).toHaveValue("Unsubmitted second note");
  await input.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(element.value.length, element.value.length),
  );
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("Unsubmitted second note\n");
});

test("section and task forms retain input on conflict and normalize through storage", async ({
  page,
}) => {
  await reset(page, "/?protocol=1");
  const d = drawer(page);
  await d.getByRole("button", { name: "Add section", exact: true }).click();
  await d.getByLabel("Title").fill("Review");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await d
    .getByRole("heading", { name: "Cart", exact: true })
    .locator("..")
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await d.getByLabel("Title").fill("Keyboard task");
  await page.keyboard.press("Escape");
  await expect(d.getByLabel("Title")).toHaveCount(0);
  await taskButton(page, "Change quantity").click();
  await d.getByLabel("Write a note").fill("Draft survives conflict");
  await page.getByRole("button", { name: "Stale next command", exact: true }).click();
  await open(page);
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    d.getByText("The QA file changed. Review the latest version and retry.", { exact: true }),
  ).toBeVisible();
  await expect(d.getByLabel("Write a note")).toHaveValue("Draft survives conflict");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(d.getByText("Draft survives conflict", { exact: true })).toBeVisible();
});

test("missing and ambiguous files remain recoverable", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("same key"))
      errors.push(message.text());
  });
  await reset(page);
  const d = drawer(page);
  await page.request.post("/__qraft-example/delete");
  await expect(d.getByText("No QA tasks yet", { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "Add section", exact: true }).click();
  await d.getByLabel("Title").fill("Recovered");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("heading", { name: "Recovered", exact: true })).toBeVisible();
  await page.request.post("/__qraft-example/malformed");
  await expect(d.getByText(/Duplicate Qraft ID/u).first()).toBeVisible();
  await expect(taskButton(page, "First duplicate")).toBeDisabled();
  await expect(taskButton(page, "Second duplicate")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("external removal retains an in-progress note edit for copying", async ({ page }) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  const d = drawer(page);
  await d.getByLabel("Write a note").fill("Original");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await d.getByRole("button", { name: "Edit note: Original", exact: true }).click();
  await d.getByLabel("Edit note", { exact: true }).fill("Keep this edit draft");
  await page.request.post("/__qraft-example/delete");
  await expect(d.getByLabel("Preserved edit draft")).toHaveValue("Keep this edit draft");
});
