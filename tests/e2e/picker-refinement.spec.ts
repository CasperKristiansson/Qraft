import { test, expect, type Page } from "@playwright/test";
import { reset, drawer, taskButton } from "./helpers";

async function picker(page: Page) {
  await reset(page, "/?picker=1");
  await taskButton(page, "Change quantity").click();
  await drawer(page).getByLabel("Write a note").fill("Keep my review draft");
  await drawer(page).getByRole("button", { name: "Attach element", exact: true }).click();
}

async function delayContext(page: Page, duration: number) {
  await page.route(/react-grab_primitives\.js/u, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("qraftOriginal")) {
      await route.continue();
      return;
    }
    url.searchParams.set("qraftOriginal", "1");
    await route.fulfill({
      contentType: "text/javascript",
      body: `export * from ${JSON.stringify(url.href)}; import { getElementContext as original } from ${JSON.stringify(url.href)}; export async function getElementContext(element) { await new Promise(resolve => setTimeout(resolve, ${duration})); return original(element); }`,
    });
  });
}

test("parent navigation holds and tracks an animated target, with optional guides and a saved source trail", async ({
  page,
}) => {
  await picker(page);
  await page.evaluate(() => {
    const container = document.createElement("div");
    container.id = "review-card";
    container.style.cssText = "position:fixed;left:60px;top:410px;padding:24px;background:white";
    const button = document.createElement("button");
    button.id = "review-action";
    button.textContent = "Review button";
    container.append(button);
    document.body.append(container);
  });
  await page.locator("#review-action").press("ArrowUp");
  await expect(page.getByText("Selection held", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#review-card")!.style.left = "620px";
  });
  await expect
    .poll(async () => (await page.locator(".qraft-picker-outline").boundingBox())!.x)
    .toBe(620);
  const label = (await page.locator(".qraft-picker-label").boundingBox())!;
  expect(label.x + label.width).toBeLessThanOrEqual(764);
  expect(label.x).toBeCloseTo(Math.min(620, 764 - label.width), 0);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#review-card")!.style.left = "60px";
  });
  const outline = page.locator(".qraft-picker-outline");
  await expect(page.locator(".qraft-picker-trail [aria-current=true]")).toHaveText(
    "div#review-card",
  );
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#review-card")!.style.transform = "translate(80px, -20px)";
  });
  await expect.poll(async () => (await outline.boundingBox())!.x).toBeCloseTo(140, 0);
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  await expect(page.locator(".qraft-picker-guides i").first()).toBeVisible();
  await page.getByRole("button", { name: "Child", exact: true }).click();
  await expect(page.locator(".qraft-picker-trail [aria-current=true]")).toHaveText(
    "button#review-action",
  );
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  await expect(drawer(page).getByLabel("Write a note")).toHaveValue("Keep my review draft");
  await drawer(page).getByRole("button", { name: "Remove attachment", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Attach element", exact: true }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await drawer(page).getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    drawer(page).locator(".qraft-note-timeline").getByText("Keep my review draft", { exact: true }),
  ).toBeVisible();
  const storedDocument = await page.request
    .get("/__qraft/document")
    .then((response) => response.json());
  const element = storedDocument.sections
    .flatMap((section: { tasks: { notes: { element: unknown }[] }[] }) => section.tasks)
    .find((task: { title: string }) => task.title === "Change quantity").notes[0].element;
  expect(element.context.sourceTrail.length).toBeGreaterThan(0);
  expect(element.context.sourceTrail.length).toBeLessThanOrEqual(5);
  expect(element.context.sourceTrail[0].source).toContain("main.tsx");
  expect(element.context.sourceTrail[0].source).not.toMatch(/^\//u);
});

test("a clicked target survives later hover and blocks pointerdown activation while context resolves", async ({
  page,
}) => {
  await delayContext(page, 700);
  await picker(page);
  await page.evaluate(() => {
    document
      .querySelector("[data-testid=quantity-value]")!
      .parentElement!.addEventListener("pointerdown", () => {
        document.body.dataset.pointerActivated = "yes";
      });
  });
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("heading", { name: "Shopping cart", exact: true }).hover();
  await expect(drawer(page).getByLabel("Write a note")).toHaveValue("Keep my review draft");
  expect(await page.locator("body").getAttribute("data-pointer-activated")).toBeNull();
  await expect(page.getByTestId("quantity-value")).toHaveText("2");
  await drawer(page).getByText("Element context", { exact: true }).click();
  await expect(drawer(page).getByText("button", { exact: true })).toBeVisible();
});

test("Escape cancels pending selection and a timed-out lookup falls back without losing the draft", async ({
  page,
}) => {
  await delayContext(page, 4_000);
  await picker(page);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(drawer(page).getByLabel("Write a note")).toHaveValue("Keep my review draft");
  await expect(
    drawer(page).getByRole("button", { name: "Remove attachment", exact: true }),
  ).toHaveCount(0);
  await drawer(page).getByRole("button", { name: "Attach element", exact: true }).click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(drawer(page).getByText(/React source context was unavailable/u)).toBeVisible({
    timeout: 4_000,
  });
  await expect(drawer(page).getByLabel("Write a note")).toHaveValue("Keep my review draft");
});

test("a dynamically inserted scaled iframe binds selection and tracks its own scroll", async ({
  page,
}) => {
  await picker(page);
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.title = "Dynamic review frame";
    frame.style.cssText =
      "position:fixed;left:35px;top:340px;width:260px;height:210px;border:8px solid gray;transform:scale(1.15);transform-origin:top left";
    frame.srcdoc =
      '<body style="margin:0;height:800px"><button style="margin:80px 20px" onclick="document.body.dataset.activated=1">Frame action</button></body>';
    document.body.append(frame);
  });
  const target = page
    .frameLocator("iframe[title='Dynamic review frame']")
    .getByRole("button", { name: "Frame action", exact: true });
  await expect(target).toBeVisible();
  await target.hover();
  await expect(page.locator(".qraft-picker-label")).toContainText("button");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  const before = (await page.locator(".qraft-picker-outline").boundingBox())!;
  await target.evaluate((element) => element.ownerDocument.defaultView!.scrollTo(0, 35));
  await expect
    .poll(async () => (await page.locator(".qraft-picker-outline").boundingBox())!.y)
    .toBeCloseTo(before.y - 35 * 1.15, 0);
  await target.click();
  await expect(drawer(page).getByLabel("Write a note")).toHaveValue("Keep my review draft");
  expect(
    await target.evaluate((element) => element.ownerDocument.body.dataset.activated),
  ).toBeUndefined();
});

test("Space attaches a focused control without activating the host", async ({ page }) => {
  await picker(page);
  await page.getByRole("button", { name: "+", exact: true }).press("Space");
  await expect(
    drawer(page).getByRole("button", { name: "Remove attachment", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("quantity-value")).toHaveText("2");
});
