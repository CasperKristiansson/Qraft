import { expect, test } from "@playwright/test";
import { reset, drawer, open, taskButton } from "./helpers";

test("checklist actions stay reachable with hundreds of tasks at every supported viewport", async ({
  page,
}) => {
  await page.route("**/__qraft/**/document", async (route) => {
    const response = await route.fetch();
    const document = await response.json();
    const section = document.sections[0];
    section.tasks.push(
      ...Array.from({ length: 200 }, (_, index) => ({
        ...section.tasks[0],
        id: `task_${(index + 100).toString(16).padStart(32, "0")}`,
        title: `Review item ${index + 1}`,
      })),
    );
    await route.fulfill({ response, json: document });
  });
  await reset(page);
  const d = drawer(page);
  const content = d.locator(".qraft-content");
  const add = d.getByRole("button", { name: "Add section", exact: true });
  await expect(
    d.getByText(/Local Markdown sync|Click to complete|Double-click to skip/u),
  ).toHaveCount(0);
  await expect(
    d.locator(".qraft-header").getByRole("button", { name: "Change file", exact: true }),
  ).toBeVisible();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1366, height: 650 },
    { width: 768, height: 900 },
    { width: 768, height: 360 },
  ]) {
    await page.setViewportSize(size);
    const initial = (await add.boundingBox())!;
    expect(initial.y + initial.height).toBeLessThanOrEqual(size.height);
    expect(initial.y).toBeGreaterThan(size.height - 100);
    expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    await taskButton(page, "Review item 200").scrollIntoViewIfNeeded();
    const last = (await taskButton(page, "Review item 200").boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(
      (await d.locator(".qraft-footer").boundingBox())!.y,
    );
    expect((await add.boundingBox())!.y).toBeCloseTo(initial.y, 0);
    await add.click();
    await d.getByLabel("Title").fill("New section");
    const save = (await d.getByRole("button", { name: "Save", exact: true }).boundingBox())!;
    expect(save.y).toBeGreaterThanOrEqual(58);
    expect(save.y + save.height).toBeLessThanOrEqual(size.height);
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(add).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test("compact vertical tab drags and remembers position without opening", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reset(page);
  await drawer(page).getByRole("button", { name: "Close Qraft", exact: true }).click();
  const tab = page.locator(".qraft-tab");
  const grip = page.getByRole("button", { name: "Move Qraft tab", exact: true });
  const box = (await tab.boundingBox())!;
  expect(box.width).toBe(26);
  expect(box.height).toBeGreaterThan(26);
  expect(box.height).toBeLessThan(95);
  const handle = (await grip.boundingBox())!;
  expect(handle.width).toBeGreaterThanOrEqual(24);
  expect(handle.height).toBeGreaterThanOrEqual(24);
  await page.mouse.move(handle.x + 8, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 8, handle.y + 140, { steps: 5 });
  await page.mouse.up();
  await expect(drawer(page)).toHaveCount(0);
  const moved = (await tab.boundingBox())!;
  expect(moved.y).toBeGreaterThan(box.y + 100);
  await page.reload();
  await expect(tab).toBeVisible();
  expect((await tab.boundingBox())!.y).toBeCloseTo(moved.y, 0);
  await grip.focus();
  await page.keyboard.press("End");
  expect((await tab.boundingBox())!.y + (await tab.boundingBox())!.height).toBeLessThanOrEqual(
    900 - 8,
  );
  await page.setViewportSize({ width: 768, height: 650 });
  expect((await tab.boundingBox())!.y + (await tab.boundingBox())!.height).toBeLessThanOrEqual(
    650 - 8,
  );
  await page.keyboard.press("Home");
  expect((await tab.boundingBox())!.y).toBe(8);
});

test("first use requires choosing a file and reload remembers only that project choice", async ({
  page,
}) => {
  await page.goto("/");
  await page.request.post("/__qraft-example/recreate");
  await open(page);
  const d = drawer(page);
  await expect(d.getByRole("heading", { name: "Choose a checklist", exact: true })).toBeVisible();
  const before = await page.request.get("/__qraft/document").then((r) => r.json());
  await d.getByRole("button", { name: "QA.local.md", exact: true }).click();
  await expect(taskButton(page, "Change quantity")).toBeVisible();
  await page.reload();
  await open(page);
  await expect(taskButton(page, "Change quantity")).toBeVisible();
  expect((await page.request.get("/__qraft/document").then((r) => r.json())).revision).toBe(
    before.revision,
  );
  await d.getByRole("button", { name: /Change file/u }).click();
  await expect(d.getByRole("heading", { name: "Choose a checklist", exact: true })).toBeVisible();
  await d.getByRole("button", { name: "Cancel file change", exact: true }).click();
  await expect(taskButton(page, "Change quantity")).toBeVisible();
});

test("selected context excludes form values and persists note text through the picker", async ({
  page,
}) => {
  await reset(page);
  await taskButton(page, "Change quantity").click();
  const d = drawer(page);
  await d.getByLabel("Write a note").fill("Describe this input");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "review-input";
    input.type = "password";
    input.value = "never-save-this";
    input.setAttribute("data-testid", "password-control");
    input.style.cssText = "position:fixed;left:40px;top:450px";
    document.body.append(input);
  });
  await d.getByRole("button", { name: "Attach element", exact: true }).click();
  await page.locator("#review-input").click();
  await expect(d.getByLabel("Write a note")).toHaveValue("Describe this input");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    d.locator(".qraft-note-timeline").getByText("Describe this input", { exact: true }),
  ).toBeVisible();
  const document = await page.request.get("/__qraft/document").then((r) => r.json());
  const note = document.sections
    .flatMap((section: { tasks: { title: string; notes: unknown[] }[] }) => section.tasks)
    .find((task: { title: string }) => task.title === "Change quantity").notes[0];
  expect(JSON.stringify(note)).not.toContain("never-save-this");
  expect(note.element.context.tag).toBe("input");
  expect(note.element.context.attributes["data-testid"]).toBe("password-control");
});
