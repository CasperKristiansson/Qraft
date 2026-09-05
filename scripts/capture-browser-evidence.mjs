import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const [
  name = "qraft",
  widthText = "1440",
  heightText = "900",
  state = "open",
  baseUrl = "http://127.0.0.1:5173",
  resetPath = "/__qraft-example/recreate",
] = process.argv.slice(2);
const width = Number(widthText);
const height = Number(heightText);
const directory = "artifacts/browser-evidence";
const path = `${directory}/${name}--${width}x${height}.png`;

await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.setDefaultTimeout(10_000);
console.log("capture: browser ready");
await page.goto(state === "protocol" ? `${baseUrl}/?protocol=1` : baseUrl, {
  waitUntil: "domcontentloaded",
  timeout: 10_000,
});
console.log("capture: example loaded");
if (["open", "checklist", "detail", "finding", "add-task", "complete", "picker", "attached"].includes(state)) {
  await page.request.post(`${baseUrl}${resetPath}`);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "domcontentloaded" });
}
if (["open", "checklist", "detail", "finding", "add-task", "complete", "picker", "attached"].includes(state)) {
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await page.locator("[data-qraft-root]").waitFor({ state: "attached" });
  await page.getByRole("dialog").waitFor({ state: "visible" });
}
if (state === "detail" || state === "finding") {
  await page.getByRole("dialog").getByRole("button", { name: "Change quantity" }).click();
}
if (state === "picker" || state === "attached") {
  await page.getByRole("dialog").getByRole("button", { name: "Change quantity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Attach element" }).click();
  const increment = page.getByRole("button", { name: "+" });
  await increment.hover();
  await page.locator("[data-qraft-root]").locator(".qraft-picker-outline").waitFor({ state: "visible" });
  if (state === "attached") {
    await increment.click();
    await page.getByRole("dialog").getByLabel("Details").fill("Increment alignment is wrong.");
  }
}
if (state === "finding") {
  await page.getByRole("dialog").getByRole("button", { name: "Finding" }).click();
  await page.getByRole("dialog").getByLabel("Details").fill("Alignment jumps from 9 to 10.");
}
if (state === "add-task") {
  await page.getByRole("dialog").getByRole("heading", { name: "CART" }).locator("..").getByRole("button", { name: "Add task" }).click();
}
if (state === "complete") {
  let document = await page.request.get(`${baseUrl}/__qraft/document`).then((response) => response.json());
  for (const task of document.sections.flatMap((section) => section.tasks).filter((task) => !task.checked)) {
    const response = await page.request.post(`${baseUrl}/__qraft/commands`, {
      headers: { "Content-Type": "application/json" },
      data: { commandId: crypto.randomUUID(), baseRevision: document.revision, command: { type: "setTaskChecked", taskId: task.id, checked: true } },
    });
    document = await response.json();
  }
  await page.waitForTimeout(900);
  await page.getByRole("dialog").getByRole("button", { name: "Expired session" }).click();
}
if (state === "protocol") {
  await page.getByRole("button", { name: /Open Qraft/u }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.getByText(/M3 live Vite protocol/u).waitFor();
}
await page.waitForTimeout(200);
console.log("capture: Qraft stable");
await page.screenshot({ path, fullPage: false });
const metrics = await page.evaluate(() => ({
  innerWidth,
  innerHeight,
  documentScrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body?.scrollWidth ?? 0,
  horizontalOverflow:
    document.documentElement.scrollWidth > innerWidth || (document.body?.scrollWidth ?? 0) > innerWidth,
}));
await browser.close();
console.log(JSON.stringify({ path, metrics }));
