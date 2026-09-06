import { expect, test } from "@playwright/test";
import { drawer, open, reset } from "./helpers";

for (const width of [1440, 390]) {
  test(`drawer animates open and closed at ${width}px and restores focus`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width, height: 900 });
    await reset(page);
    await drawer(page).getByRole("button", { name: "Close Qraft", exact: true }).click();
    await expect(drawer(page)).toHaveCount(0);
    await page.evaluate(() => {
      const host = document.querySelector("[data-qraft-root]")!;
      host.setAttribute("data-motion-events", "[]");
      for (const type of ["animationstart", "animationend"]) {
        host.shadowRoot!.addEventListener(type, (event) => {
          const animation = event as AnimationEvent;
          const target = animation.target as HTMLElement;
          if (!target.matches(".qraft-drawer")) return;
          const events = JSON.parse(host.getAttribute("data-motion-events")!) as string[];
          events.push(
            `${type}:${animation.animationName}:${target.dataset.state}:${target.isConnected}`,
          );
          host.setAttribute("data-motion-events", JSON.stringify(events));
        });
      }
    });
    await open(page);
    await expect(drawer(page)).toHaveCSS(
      "--qraft-hidden-transform",
      width === 390 ? "translateY(100%)" : "translateX(100%)",
    );
    await expect
      .poll(() => page.locator("[data-qraft-root]").getAttribute("data-motion-events"))
      .toContain("animationend:qraft-enter:open:true");
    await drawer(page).getByRole("button", { name: "Close Qraft", exact: true }).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open Qraft/u })).toBeFocused();
    const events = JSON.parse(
      (await page.locator("[data-qraft-root]").getAttribute("data-motion-events"))!,
    ) as string[];
    expect(events).toContain("animationstart:qraft-exit:closed:true");
    expect(events).toContain("animationend:qraft-exit:closed:true");
    await open(page);
    await expect(drawer(page).getByRole("heading", { name: "Qraft", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
