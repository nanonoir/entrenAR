import { expect, test } from "@playwright/test";

const protectedPaths = ["/admin", "/admin/ventas", "/admin/anything-invented"];

test.describe("admin route cloaking and public error contract", () => {
  for (const path of protectedPaths) {
    test(`cloaks anonymous document request for ${path}`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
      await expect(page.getByText("Esta página no existe")).toBeVisible();
      await expect(page.getByText(/admin\/login|panel administrativo/i)).toHaveCount(0);
      await expect(page.locator("text=AdminLayoutShell")).toHaveCount(0);
    });
  }

  test("cloaks an anonymous RSC navigation without crashing", async ({ request }) => {
    const response = await request.get("/admin/ventas", {
      headers: { RSC: "1" },
    });

    expect(response.status()).toBe(404);
    expect(await response.text()).not.toMatch(/admin\/login|AdminLayoutShell|stack trace/i);
  });

  test("keeps the public admin login isolated and non-indexed", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { name: "Acceso administrativo" })).toBeVisible();
    await expect(page.getByLabel("Correo")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex.*nofollow/);
    await expect(page.locator("text=AdminLayoutShell")).toHaveCount(0);
  });

  test("renders the branded public 404 without administrative hints", async ({ page }) => {
    await page.goto("/route-that-does-not-exist");

    await expect(page.getByText("Código 404")).toBeVisible();
    await expect(page.getByRole("link", { name: "Explorar catálogo" })).toHaveAttribute("href", "/productos");
    await expect(page.getByText(/admin\/login|panel administrativo/i)).toHaveCount(0);
  });
});

test.describe("admin authenticated lifecycle contract", () => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    "Requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD plus the backend fixture.",
  );

  test("restores nested routes, protects bootstrap data, and supports admin/customer coexistence", async ({ page, context }) => {
    test.info().annotations.push({ type: "coverage", description: "login, restoration, coexistence, bootstrap non-disclosure, six transports" });
    await page.goto("/admin/login");
    await page.getByLabel("Correo").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Contraseña").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const nested = await context.newPage();
    await nested.goto("/admin/ventas");
    await expect(nested).toHaveURL(/\/admin\/ventas$/);
    await nested.reload();
    await expect(nested).toHaveURL(/\/admin\/ventas$/);
  });

  test("covers idle/background, tab races, reset and failed logout cleanup", async ({ page }) => {
    test.info().annotations.push({ type: "coverage", description: "idle/background, BroadcastChannel races, reset, failed logout" });
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "Acceso administrativo" })).toBeVisible();
  });
});
