import { expect, test } from "@playwright/test";
import { drawer, open } from "./helpers";

test("first review explains creation without choosing or changing a file", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
    });
  });
  await page.goto("/");
  await page.request.post("/__qraft-example/recreate");
  const before = await page.request.get("/__qraft/document").then((response) => response.json());
  await open(page);
  const d = drawer(page);
  const guide = d.getByRole("link", { name: "Checklist guide on GitHub" });
  await expect(guide).toHaveAttribute(
    "href",
    "https://github.com/CasperKristiansson/Qraft/blob/main/docs/creating-checklists.md",
  );
  await expect(guide).toHaveAttribute("rel", "noopener noreferrer");
  await expect(d.getByText(/Ask Codex, Claude Code, or ChatGPT/u)).toBeVisible();
  await d.locator("summary").click();
  const prompt = d.getByLabel("Give this to your agent or chat");
  await expect(prompt).toHaveValue(/skills\/qraft-review\/SKILL.md/u);
  await expect(prompt).toHaveValue(/If you cannot write files, return the Markdown/u);
  await d.getByRole("button", { name: "Copy prompt" }).click();
  await expect(d.getByRole("status")).toHaveText(/copy it manually/u);
  await expect(prompt).toBeVisible();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1366, height: 650 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(size);
    const refresh = d.getByRole("button", { name: "Refresh files" });
    await refresh.scrollIntoViewIfNeeded();
    const bounds = (await refresh.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
    expect(await d.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await d.getByLabel("Find a Markdown file").fill("z".repeat(200));
  await expect(d.getByText(/No files match/u)).toBeVisible();
  expect(
    await d
      .locator(".qraft-content")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(d.getByRole("button", { name: "QA.local.md", exact: true })).toHaveCount(0);
  await d.getByLabel("Find a Markdown file").fill("");
  await expect(d.getByRole("button", { name: "QA.local.md", exact: true })).toBeVisible();
  expect(
    (await page.request.get("/__qraft/document").then((response) => response.json())).revision,
  ).toBe(before.revision);
});

test("empty catalogs and refresh failures preserve the creation guidance", async ({ page }) => {
  let fail = false;
  await page.route("**/__qraft/files", async (route) => {
    if (fail) return route.fulfill({ status: 503, json: { error: "unavailable" } });
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ response, json: { ...catalog, files: [] } });
  });
  await page.goto("/");
  await open(page);
  const d = drawer(page);
  await expect(d.getByText(/No Markdown files yet/u)).toBeVisible();
  fail = true;
  await d.getByRole("button", { name: "Refresh files" }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  await expect(d.getByRole("heading", { name: "Create a checklist", exact: true })).toBeVisible();
  fail = false;
  await d.getByRole("button", { name: "Refresh files" }).click();
  await expect(d.getByRole("alert")).toHaveCount(0);
  await expect(d.getByText(/No Markdown files yet/u)).toBeVisible();
});
