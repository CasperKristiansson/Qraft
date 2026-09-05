import { expect, test, type Page } from "@playwright/test";
import type { QADocument } from "../../src/domain/model";

async function readDocument(page: Page): Promise<QADocument> {
  return page.request.get("/__qraft/document").then((response) => response.json() as Promise<QADocument>);
}

async function reset(page: Page, path = "/") {
  await page.goto(path);
  await page.request.post("/__qraft-example/recreate");
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Change quantity" }).click();
}

async function attach(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Attach element" }).click();
  await expect(page.getByRole("button", { name: "Cancel element picker" })).toBeVisible();
}

test("M5 picker highlights a host control, suppresses its click, persists only approved context, and fails source-open safely", async ({ page }) => {
  await reset(page);
  await attach(page);
  const quantity = page.getByTestId("quantity-value");
  const increment = page.getByRole("button", { name: "+" });
  await increment.hover();
  const pickerRoot = page.locator("[data-qraft-root]");
  await expect(pickerRoot.locator(".qraft-picker-outline")).toBeVisible();
  await expect(pickerRoot.locator(".qraft-picker-label")).not.toBeEmpty();
  await increment.click();
  await expect(quantity).toHaveText("2");

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(/main\.tsx/u)).toBeVisible();
  await drawer.getByLabel("Details").fill("Increment alignment is wrong.");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => {
    const document = await readDocument(page);
    return document.sections.flatMap((section) => section.tasks).find((task) => task.title === "Change quantity")?.findings.length ?? 0;
  }).toBe(1);
  const document = await readDocument(page);
  const finding = document.sections.flatMap((section) => section.tasks).find((task) => task.title === "Change quantity")!.findings[0]!;
  const element = finding.element;
  expect(element).not.toBeNull();
  if (!element?.source) throw new Error("Expected the React example target to include a normalized source path.");
  expect(Object.keys(element).sort()).toEqual(["column", "component", "line", "route", "selector", "source"]);
  expect(element.route).toBe("/");
  expect(element.source).not.toContain("?");
  expect(element.source).not.toContain("#");
  expect(await quantity.textContent()).toBe("2");

  await page.route("**/__open-in-editor?**", (route) => route.fulfill({ status: 500, body: "blocked" }));
  await page.evaluate(() => { window.open = () => { throw new Error("blocked fallback"); }; });
  await drawer.getByRole("button", { name: "Open source" }).click();
  await expect(drawer.getByRole("alert").filter({ hasText: "Could not open" })).toContainText(element.source);
});

test("M5 picker ignores itself, cancels cleanly, and falls back to a plain finding", async ({ page }) => {
  await reset(page, "/?picker=1");
  const before = await readDocument(page);
  await attach(page);
  const cancel = page.getByRole("button", { name: "Cancel element picker" });
  await cancel.hover();
  await expect(page.locator("[data-qraft-root]").locator(".qraft-picker-outline")).toBeHidden();
  await cancel.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Change quantity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach element" })).toBeFocused();
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByTestId("quantity-value")).toHaveText("3");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: /Open Qraft/u }).click();

  await attach(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByTestId("quantity-value")).toHaveText("4");
  await expect(page.getByRole("dialog")).toBeHidden();
  const afterEscape = await readDocument(page);
  expect(afterEscape.revision).toBe(before.revision);

  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await attach(page);
  await page.locator("#context-fallback-target").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(/source context was unavailable/u)).toBeVisible();
  await drawer.getByRole("button", { name: "Use plain finding" }).click();
  await drawer.getByLabel("Details").fill("Plain fallback finding.");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByText("Plain fallback finding.")).toBeVisible();
  await expect.poll(async () => {
    const current = await readDocument(page);
    return current.sections.flatMap((section) => section.tasks).find((candidate) => candidate.title === "Change quantity")?.findings.length ?? 0;
  }).toBe(1);
  const finalDocument = await readDocument(page);
  const task = finalDocument.sections.flatMap((section) => section.tasks).find((candidate) => candidate.title === "Change quantity");
  expect(task).toBeDefined();
  expect(task!.findings.at(-1)!.element).toBeNull();
});

test("M5 picker reaches open shadow roots and same-origin iframes", async ({ page }) => {
  await reset(page, "/?picker=1");
  await attach(page);
  await page.locator("[data-testid=shadow-quantity]").click();
  await expect(page.getByRole("dialog").getByLabel("Details")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  await attach(page);
  await page.frameLocator("iframe[title='Same-origin picker target']").getByRole("button", { name: "Iframe quantity" }).click();
  await expect(page.getByRole("dialog").getByLabel("Details")).toBeVisible();
});
