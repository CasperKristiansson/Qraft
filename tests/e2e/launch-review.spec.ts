import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { drawer, open, reset, taskButton } from "./helpers";

const local = resolve("examples/vite-react/QA.local.md");

test("pinned review preserves host interaction, navigation drafts and reload position", async ({
  page,
}) => {
  await reset(page);
  await drawer(page).getByRole("button", { name: "Keep Qraft open", exact: true }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(drawer(page)).toBeVisible();
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("Draft on the first task");
  await drawer(page).getByRole("button", { name: "Next", exact: true }).click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("Draft on the second task");
  await drawer(page).getByRole("button", { name: "Previous", exact: true }).click();
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Draft on the first task",
  );
  await page.reload();
  await open(page);
  await expect(
    drawer(page).getByRole("heading", { name: "Change quantity", exact: true }),
  ).toBeVisible();
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Draft on the first task",
  );
  await expect(
    drawer(page).getByRole("button", { name: "Keep Qraft open", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(drawer(page)).toBeVisible();
  await drawer(page).getByRole("button", { name: "Complete and next", exact: true }).click();
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Draft on the second task",
  );
});

test("a fifty-task review supports collapse, sticky controls and explicit next actions", async ({
  page,
}) => {
  await reset(page);
  await page.request.post("/__qraft-example/long-review");
  await expect(taskButton(page, "Check 01")).toBeVisible();
  await expect(drawer(page).locator(".qraft-task")).toHaveCount(50);
  await expect(drawer(page).getByRole("searchbox")).toHaveCount(0);
  await expect(
    drawer(page).getByRole("button", { name: "Review handoff", exact: true }),
  ).toHaveCount(0);
  await taskButton(page, "Check 40").click();
  await expect(
    drawer(page).getByRole("button", { name: "Next unfinished", exact: true }),
  ).toHaveCount(0);
  const nav = drawer(page).getByRole("navigation", { name: "Review tasks" });
  const boxes = await Promise.all(
    ["Previous", "Complete and next", "Next"].map((name) =>
      nav.getByRole("button", { name, exact: true }).boundingBox(),
    ),
  );
  expect(boxes.every((box) => box && box.y === boxes[0]!.y)).toBe(true);
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
  await drawer(page).getByRole("button", { name: "Complete and next", exact: true }).click();
  await expect(drawer(page).getByRole("heading", { name: "Check 41", exact: true })).toBeVisible();
  await drawer(page).getByRole("button", { name: "Back to checklist", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Interface 50", exact: true }).click();
  await page.reload();
  await open(page);
  await expect(
    drawer(page).getByRole("button", { name: "Interface 50", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    drawer(page).getByRole("button", { name: "Add section", exact: true }),
  ).toBeVisible();
});

test("ambiguous legacy recovery keeps text copyable after an external move", async ({ page }) => {
  await reset(page);
  await page.request.post("/__qraft-example/legacy");
  await expect(taskButton(page, "Legacy task")).toBeVisible();
  await taskButton(page, "Legacy task").click();
  await drawer(page)
    .getByLabel("Write a note", { exact: true })
    .fill("Do not lose this observation");
  await writeFile(local, "# An external heading\n" + (await readFile(local, "utf8")));
  await expect(drawer(page).getByLabel("Preserved draft", { exact: true })).toHaveValue(
    "Do not lose this observation",
  );
  await page.reload();
  await open(page);
  await expect(drawer(page).getByLabel("Preserved draft", { exact: true })).toHaveValue(
    "Do not lose this observation",
  );
  expect(await readFile(local, "utf8")).not.toContain("Do not lose this observation");
});

test("narrow review collapses to a task strip and keeps the app operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reset(page);
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("Mobile feedback");
  await drawer(page).getByRole("button", { name: "Collapse to task strip", exact: true }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Qraft current task" })).toBeVisible();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "Expand Qraft", exact: true }).click();
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Mobile feedback",
  );
  await drawer(page).getByRole("button", { name: "Submit", exact: true }).click();
  await expect(drawer(page).getByText("/ · 390 × 844", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 640 });
  const bounds = await drawer(page).boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(360);
  await expect(
    drawer(page).getByRole("button", { name: "Complete and next", exact: true }),
  ).toBeVisible();
});

test("two browser tabs keep independent unsent drafts", async ({ page, context }) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note", { exact: true }).fill("First tab draft");
  const second = await context.newPage();
  await second.goto("/");
  await open(second);
  await taskButton(second, "Change quantity").click();
  await drawer(second).getByLabel("Write a note", { exact: true }).fill("Second tab draft");
  await page.reload();
  await open(page);
  await second.reload();
  await open(second);
  await expect(drawer(page).getByLabel("Write a note", { exact: true })).toHaveValue(
    "First tab draft",
  );
  await expect(drawer(second).getByLabel("Write a note", { exact: true })).toHaveValue(
    "Second tab draft",
  );
});

test("clearing a saved review requires an explicit action", async ({ page }) => {
  await reset(page);
  await drawer(page).getByRole("button", { name: "Settings", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Clear saved session…", exact: true }).click();
  await expect(drawer(page).getByRole("group", { name: "Confirm clearing session" })).toBeVisible();
  await drawer(page).getByRole("button", { name: "Discard unsaved session", exact: true }).click();
  await expect(taskButton(page, "Change quantity")).toBeVisible();
});

test("a task-title draft survives an externally moved legacy section without a misdirected save", async ({
  page,
}) => {
  await reset(page);
  await page.request.post("/__qraft-example/legacy");
  await expect(taskButton(page, "Legacy task")).toBeVisible();
  await drawer(page).getByRole("button", { name: "Add task", exact: true }).click();
  await drawer(page).getByLabel("Title", { exact: true }).fill("Preserved task title");
  await drawer(page)
    .getByLabel("Description (optional)", { exact: true })
    .fill("Keep the task prerequisites too.");
  const external = "# External heading\n" + (await readFile(local, "utf8"));
  await writeFile(local, external);
  await expect(drawer(page).getByLabel("Preserved task title", { exact: true })).toHaveValue(
    "Preserved task title",
  );
  await expect(drawer(page).getByLabel("Preserved task description", { exact: true })).toHaveValue(
    "Keep the task prerequisites too.",
  );
  await page.reload();
  await open(page);
  await expect(drawer(page).getByLabel("Preserved task title", { exact: true })).toHaveValue(
    "Preserved task title",
  );
  expect(await readFile(local, "utf8")).toBe(external);
  await expect(drawer(page).getByLabel("Preserved task description", { exact: true })).toHaveValue(
    "Keep the task prerequisites too.",
  );
});

test("navigation leaves the first note editable and picker cancellation retains it", async ({
  page,
}) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  const note = drawer(page).getByLabel("Write a note", { exact: true });
  await note.pressSequentially("First input must be retained");
  await expect(note).toHaveValue("First input must be retained");
  await expect(note).toBeFocused();
  await drawer(page).getByRole("button", { name: "Attach element", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(note).toHaveValue("First input must be retained");
});

test("detail status circle cycles all states without navigating or losing a note draft", async ({
  page,
}) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  const d = drawer(page);
  const status = d.locator(".qraft-detail-heading .qraft-status");
  await d.getByLabel("Write a note", { exact: true }).fill("Keep this draft while reviewing.");
  for (const state of ["Completed", "Skipped", "Not completed"]) {
    await status.click();
    await expect(status).toHaveAccessibleName(`Change quantity: ${state}. Change status`);
    await expect(d.getByRole("heading", { name: "Change quantity", exact: true })).toBeVisible();
    await expect(d.getByLabel("Write a note", { exact: true })).toHaveValue(
      "Keep this draft while reviewing.",
    );
  }
  await expect(status).toBeEnabled();
  await status.press("Space");
  await expect(status).toHaveAccessibleName("Change quantity: Completed. Change status");
  await expect(status).toBeEnabled();
  await status.press("Enter");
  await expect(status).toHaveAccessibleName("Change quantity: Skipped. Change status");
  await d.getByRole("button", { name: "Back to checklist", exact: true }).click();
  await expect(
    d.getByRole("button", { name: "Change quantity: Skipped. Change status", exact: true }),
  ).toBeVisible();
});
