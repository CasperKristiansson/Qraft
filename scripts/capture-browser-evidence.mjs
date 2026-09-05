import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const [
  name = "qraft",
  widthText = "1440",
  heightText = "900",
  state = "checklist",
  baseUrl = "http://127.0.0.1:5173",
  resetPath = "/__qraft-example/recreate",
] = process.argv.slice(2);
const width = Number(widthText),
  height = Number(heightText);
const directory = "artifacts/browser-evidence";
const path = `${directory}/${name}--${width}x${height}.png`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(10_000);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.request.post(`${baseUrl}${resetPath}`);
  await page.reload();
  const drawer = page.getByRole("dialog");
  if (state !== "closed") {
    await page.getByRole("button", { name: /Open Qraft/u }).click();
    await expect(
      drawer.getByRole("heading", { name: "Choose a checklist", exact: true }),
    ).toBeVisible();
    if (state !== "files") {
      const file = drawer.getByRole("button", { name: "QA.local.md", exact: true });
      await (
        (await file.count()) ? file : drawer.getByRole("button", { name: "QA.md", exact: true })
      ).click();
      await expect(
        drawer.locator(".qraft-task").filter({ hasText: "Change quantity" }),
      ).toBeVisible();
    }
  }
  if (["detail", "note", "picker", "attached", "complete"].includes(state))
    await drawer.locator(".qraft-task").filter({ hasText: "Change quantity" }).click();
  if (state === "note")
    await drawer.getByLabel("Write a note").fill("Alignment jumps from 9 to 10.");
  if (["picker", "attached"].includes(state)) {
    await drawer.getByRole("button", { name: "Attach element", exact: true }).click();
    const increment = page.getByRole("button", { name: "+", exact: true });
    await increment.hover();
    await expect(page.locator(".qraft-picker-outline")).toBeVisible();
    if (state === "attached") {
      await increment.click();
      await drawer.getByLabel("Write a note").fill("The increment button needs more spacing.");
    }
  }
  if (state === "add-task")
    await drawer
      .getByRole("heading", { name: "Cart", exact: true })
      .locator("..")
      .getByRole("button", { name: "Add task", exact: true })
      .click();
  if (state === "complete") {
    await drawer.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(drawer.getByRole("button", { name: "Completed", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  if (state !== "picker") await page.mouse.move(10, 10);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  const metrics = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  if (metrics.documentScrollWidth > width || metrics.bodyScrollWidth > width)
    throw new Error("Horizontal overflow in capture.");
  console.log(JSON.stringify({ path, metrics, url: page.url(), state }));
} finally {
  await browser.close();
}
