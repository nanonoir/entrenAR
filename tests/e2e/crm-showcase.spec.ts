import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

test("synthetic storefront: fresh discovery, depleted detail and both card densities", async ({ page, request, baseURL }) => {
  test.skip(baseURL !== "http://127.0.0.1:3217", "Requires the dedicated synthetic fixture config, never the habitual application.");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = "http://127.0.0.1:3218";
  await request.post(`${fixture}/__fixture/reset`);
  const catalog = await (await request.get(`${fixture}/api/v1/products`)).json();
  expect(catalog.items.map((product: { id: string }) => product.id)).toEqual(["current", "category", "brand", "mixed", "infinite", "empty", "unrelated"]);
  await page.goto("/");
  const home = page.getByRole("list", { name: "Los mas vendidos", exact: true });
  await expect(home.getByRole("link", { name: "Ver Fixture empty", exact: true })).toHaveCount(0);
  await expect(home.getByRole("link", { name: "Ver Fixture mixed", exact: true })).toHaveCount(1);
  await expect(home.getByRole("link", { name: "Ver Fixture infinite", exact: true })).toHaveCount(1);
  await page.screenshot({ path: join(tmpdir(), "opencode", "crm-storefront-home.png"), fullPage: true });
  await home.getByRole("link", { name: "Ver Fixture current", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fixture current", exact: true, level: 1 })).toBeVisible();
  const related = () => page.getByRole("article").getByRole("link", { name: /^Ver / });
  expect(await related().evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
    "/productos/fixture-category", "/productos/fixture-infinite", "/productos/fixture-mixed", "/productos/fixture-brand",
  ]);
  await page.screenshot({ path: join(tmpdir(), "opencode", "crm-storefront-related.png"), fullPage: true });
  await request.post(`${fixture}/__fixture/deplete`); // In-memory test state only, never a database write.
  await page.reload();
  await expect(related()).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Ver Fixture mixed", exact: true })).toHaveCount(0);
  await page.goto("/");
  await expect(home.getByRole("link", { name: "Ver Fixture mixed", exact: true })).toHaveCount(0);
  await expect(home.getByRole("link", { name: "Ver Fixture infinite", exact: true })).toHaveCount(1);
  await page.goto("/fixture-category");
  await expect(page.getByRole("article")).toHaveCount(7);
  const depleted = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Fixture empty", exact: true }) });
   await expect(depleted.getByRole("button", { name: "Sin stock", exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(tmpdir(), "opencode", "crm-storefront-listing-mobile.png"), fullPage: true });
  await depleted.getByRole("link", { name: "Ver Fixture empty", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fixture empty", level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito", exact: true })).toBeDisabled();
  expect(pageErrors).toEqual([]);

  // Standard density has no depleted live route; use the real SSR component fixture with the live app stylesheet.
  const css = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  const { stdout } = await promisify(execFile)(process.execPath,
    [resolve("node_modules/tsx/dist/cli.mjs"), resolve("tests/harnesses/product-card.harness.tsx"), "--html"], { timeout: 30000 });
  await page.setContent(`${css.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}${stdout}`);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of ["Standard depleted", "Compact depleted"]) {
      const section = page.getByRole("region", { name, exact: true });
       const badge = section.getByRole("button", { name: "Sin stock", exact: true });
       await expect(badge).toBeVisible();
       await expect(badge).toBeDisabled();
      await expect(section.getByRole("link", { name: `Ver ${name}`, exact: true })).toHaveCount(1);
      const geometry = await badge.evaluate((element) => {
        const stock = element.getBoundingClientRect();
        const labels = Array.from(element.closest("article")!.querySelectorAll("span")).filter((entry) => entry !== element && (/ENVÍO GRATIS|^-\d+%$/.test(entry.textContent ?? "")));
        const overlap = labels.some((label) => { const box = label.getBoundingClientRect(); return box.width > 0 && stock.left < box.right && stock.right > box.left && stock.top < box.bottom && stock.bottom > box.top; });
         const style = getComputedStyle(element);
         const rgb = (color: string) => {
           const canvas = document.createElement("canvas");
           canvas.width = canvas.height = 1;
           const context = canvas.getContext("2d")!;
           context.fillStyle = color;
           context.fillRect(0, 0, 1, 1);
           return `rgb(${Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).join(", ")})`;
         };
         return { overlap, color: rgb(style.color), background: rgb(style.backgroundColor), live: element.closest("[aria-live], [role=alert]") !== null };
      });
      expect(geometry.overlap).toBe(false);
      expect(geometry.live).toBe(false);
      expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
       const luminance = (color: string) => {
         const rgb = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map(Number);
         const linear = rgb.map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
         return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
       };
       const values = [luminance(geometry.color), luminance(geometry.background)].sort((a, b) => a - b);
       expect((values[1] + 0.05) / (values[0] + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    await expect(page.getByRole("region", { name: "Available", exact: true }).getByText("Sin stock", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Infinite", exact: true }).getByText("Sin stock", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: join(tmpdir(), "opencode", `crm-storefront-cards-${width}.png`), fullPage: true });
  }
  await request.post(`${fixture}/__fixture/reset`);
});
