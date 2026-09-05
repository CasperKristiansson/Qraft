import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page, path = "/") {
  await page.goto(path);
  await page.request.post("/__qraft-example/recreate");
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("M4 task detail blocks pass, resolves findings, advances, completes, and reopens", async ({ page }) => {
  await reset(page);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Change quantity" }).click();
  await expect(drawer.getByRole("heading", { name: "Change quantity" })).toBeVisible();

  await drawer.getByRole("button", { name: "Note" }).click();
  await drawer.getByLabel("Details").fill("Quantity uses a full pricing refresh.");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByText("Quantity uses a full pricing refresh.")).toBeVisible();

  await drawer.getByRole("button", { name: "Finding" }).click();
  await drawer.getByLabel("Details").fill("Alignment jumps at two digits.");
  await drawer.getByRole("button", { name: "Save" }).click();
  const pass = drawer.getByRole("button", { name: "Pass" });
  await expect(pass).toBeDisabled();
  await expect(drawer.getByText("Resolve outstanding findings before passing this task.")).toBeVisible();

  await drawer.getByRole("checkbox", { name: /Resolve finding/u }).click();
  await expect(pass).toBeEnabled();
  await pass.click();
  await expect(drawer.getByRole("heading", { name: "Remove product" })).toBeVisible();
  await drawer.getByRole("button", { name: "Pass" }).click();
  await expect(drawer.getByRole("heading", { name: "Expired session" })).toBeVisible();
  await drawer.getByRole("button", { name: "Pass" }).click();
  await expect(drawer.getByText("Checklist complete")).toBeVisible();
  await drawer.getByRole("button", { name: "Reopen" }).click();
  await expect(drawer.getByText("Not completed")).toBeVisible();
});

test("M4 forms focus, normalize through storage, cancel with Escape, and retain drafts across refresh/conflict", async ({ page }) => {
  await reset(page, "/?protocol=1");
  const drawer = page.getByRole("dialog");
  const cartAdd = drawer.getByRole("heading", { name: "CART" }).locator("..").getByRole("button", { name: "Add task" });
  await cartAdd.click();
  const title = drawer.getByLabel("Title");
  await expect(title).toBeFocused();
  await title.fill("  Keyboard\n task  ");
  await page.keyboard.press("Escape");
  await expect(title).toBeHidden();
  await expect(cartAdd).toBeFocused();

  await cartAdd.click();
  await drawer.getByLabel("Title").fill("Keyboard task");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("button", { name: "Keyboard task" })).toBeVisible();

  await drawer.getByRole("button", { name: "Change quantity" }).click();
  await drawer.getByRole("button", { name: "Finding" }).click();
  await drawer.getByLabel("Details").fill("Draft survives refresh");
  await page.request.post("/__qraft-example/external-edit");
  await page.waitForTimeout(900);
  await expect(drawer.getByLabel("Details")).toHaveValue("Draft survives refresh");
  await page.getByRole("button", { name: "Stale next command" }).click();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByText("The QA file changed. Review the latest version and retry.")).toBeVisible();
  await expect(drawer.getByLabel("Details")).toHaveValue("Draft survives refresh");
});

test("M4 drawer preserves host geometry and keyboard focus at desktop and supported narrow width", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }]) {
    await page.setViewportSize(viewport);
    await reset(page);
    const host = page.getByTestId("host-layout");
    const before = await host.boundingBox();
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Qraft" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await host.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(scroll);
    await expect(page.getByRole("button", { name: /Open Qraft/u })).toBeFocused();
  }
});

test("M4 missing and malformed files remain recoverable", async ({ page }) => {
  const duplicateKeyErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" && message.text().includes("same key")) duplicateKeyErrors.push(message.text()); });
  await reset(page, "/?protocol=1");
  let drawer = page.getByRole("dialog");
  await page.request.post("/__qraft-example/delete");
  await expect(drawer.getByText("No QA tasks yet")).toBeVisible();
  await drawer.getByRole("button", { name: "Add section" }).click();
  await drawer.getByLabel("Title").fill("Recovered section");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("heading", { name: "RECOVERED SECTION" })).toBeVisible();

  await page.request.post("/__qraft-example/malformed");
  await expect(drawer.getByText(/Duplicate Qraft ID/u).first()).toBeVisible();
  await expect(drawer.getByText(/Lines/u).first()).toBeVisible();
  await expect(drawer.getByRole("button", { name: "First duplicate" })).toBeDisabled();
  await expect(drawer.getByRole("button", { name: "Second duplicate" })).toBeDisabled();
  expect(duplicateKeyErrors).toEqual([]);
});
