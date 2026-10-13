import { expect, test, type Locator } from "@playwright/test";

test.beforeEach(async ({ baseURL }) => {
  test.skip(baseURL !== "http://127.0.0.1:3217", "Requires the isolated synthetic catalog, never the application database.");
});

async function slideGeometry(viewer: Locator) {
  return viewer.evaluate((element) => {
    const track = element.firstElementChild!;
    return Array.from(track.children).map((slide) => {
      const content = slide.firstElementChild!;
      return { width: slide.getBoundingClientRect().width, viewportWidth: element.clientWidth, overflow: getComputedStyle(slide).overflow, transform: getComputedStyle(content).transform, origin: getComputedStyle(content).transformOrigin, hidden: slide.getAttribute("aria-hidden") };
    });
  });
}

test("desktop: bounded thumbnail rail, isolated zoom, full-width complete description and variant synchronization", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/productos/fixture-gallery-many");
  const rail = page.getByLabel("Miniaturas del producto", { exact: true });
  const zoom = () => page.getByRole("button", { name: /^(Ampliar|Alejar) imagen$/ });
  const up = page.getByRole("button", { name: "Miniaturas anteriores", exact: true });
  const down = page.getByRole("button", { name: "Miniaturas siguientes", exact: true });
  await expect(rail).toBeVisible();
  await expect(up).toBeDisabled();
  await expect(down).toBeEnabled();
  expect((await rail.boundingBox())!.height).toBeLessThanOrEqual((await zoom().boundingBox())!.height + 2);
  await down.click();
  await expect(up).toBeEnabled();

  for (const index of [0, 6, 12]) {
    if (index > 0) for (let next = index === 6 ? 0 : 6; next < index; next++) await page.getByRole("button", { name: "Imagen siguiente", exact: true }).click();
    await expect(zoom().locator('div[aria-hidden="false"] img')).toHaveAttribute("alt", `Gallery frame ${index + 1}`);
    await expect(zoom()).toHaveAccessibleName("Ampliar imagen");
    await zoom().click();
    await expect(zoom()).toHaveAccessibleName("Alejar imagen");
    await expect.poll(async () => (await slideGeometry(zoom()))[index].transform).toBe("matrix(1.5, 0, 0, 1.5, 0, 0)");
    const slides = await slideGeometry(zoom());
    expect(slides.every((slide) => Math.abs(slide.width - slide.viewportWidth) < 1 && slide.overflow === "hidden")).toBe(true);
    expect(slides.filter((slide) => slide.transform !== "matrix(1, 0, 0, 1, 0, 0)" && slide.transform !== "none")).toHaveLength(1);
    const box = (await zoom().boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    const start = (await slideGeometry(zoom()))[index].origin;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
    await expect.poll(async () => (await slideGeometry(zoom()))[index].origin).not.toBe(start);
    if (index < 12) {
      const origin = (await slideGeometry(zoom()))[index].origin;
      await zoom().click({ position: { x: box.width * 0.8, y: box.height * 0.8 } });
      expect((await slideGeometry(zoom()))[index].origin).toBe(origin);
    }
  }
  const last = rail.getByRole("button", { name: "Ver imagen 13 de Fixture gallery", exact: true });
  const selectedBounds = (await last.boundingBox())!;
  const railBounds = (await rail.boundingBox())!;
  expect(selectedBounds.y + selectedBounds.height).toBeLessThanOrEqual(railBounds.y + railBounds.height + 1);
  await expect(down).toBeDisabled();
  // Existing structured selection must drive the image, reset zoom and expose the selected thumbnail.
  await page.getByRole("button", { name: "Middle", exact: true }).click();
  await expect(zoom()).toHaveAccessibleName("Ampliar imagen");
  await expect(zoom().locator('div[aria-hidden="false"] img')).toHaveAttribute("alt", "Gallery frame 7");
  await expect(rail.getByRole("button", { name: "Ver imagen 7 de Fixture gallery", exact: true })).toHaveAttribute("aria-pressed", "true");

  const description = page.getByRole("region", { name: "Descripción", exact: true });
  const descriptionBox = (await description.boundingBox())!;
  const upperBox = await page.getByRole("heading", { name: "Fixture gallery", level: 1 }).evaluate((heading) => {
    const section = heading.closest("section")!;
    const rect = section.getBoundingClientRect();
    return { bottom: rect.bottom + window.scrollY, width: rect.width };
  });
  expect(descriptionBox.y).toBeGreaterThanOrEqual(upperBox.bottom);
  expect(descriptionBox.width).toBeCloseTo(upperBox.width, 0);
  await expect(description.getByText("END OF COMPLETE DESCRIPTION", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("mobile and tablet: existing dots and touch navigation without desktop controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1023]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/productos/fixture-gallery-many");
    await expect(page.getByLabel("Miniaturas del producto", { exact: true })).toBeHidden();
    const dots = page.getByRole("button", { name: /^Ver imagen \d+$/ });
    await expect(dots).toHaveCount(13);
    await expect(dots.nth(6)).toBeVisible();
    await dots.nth(6).click();
    await expect(dots.nth(6)).toHaveAttribute("aria-current", "true");
    const viewer = page.getByRole("button", { name: "Ampliar imagen", exact: true });
    await viewer.evaluate((element) => {
      for (const [name, clientX] of [["touchstart", 250], ["touchend", 100]] as const) {
        const event = new Event(name, { bubbles: true });
        Object.defineProperty(event, "changedTouches", { value: [{ clientX }] });
        element.dispatchEvent(event);
      }
    });
    await expect(dots.nth(7)).toHaveAttribute("aria-current", "true");
    await viewer.click();
    await expect(page.getByRole("button", { name: "Alejar imagen", exact: true })).toBeVisible();
    await dots.nth(0).click();
    await expect(page.getByRole("button", { name: "Ampliar imagen", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imagen siguiente", exact: true })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("single image: no unnecessary controls, contained zoom and keyboard toggle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/productos/fixture-gallery-single");
  await expect(page.getByRole("button", { name: "Miniaturas siguientes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Imagen siguiente", exact: true })).toHaveCount(0);
  const viewer = page.getByRole("button", { name: /^(Ampliar|Alejar) imagen$/ });
  await viewer.focus();
  await page.keyboard.press("Enter");
  await expect(viewer).toHaveAccessibleName("Alejar imagen");
  expect((await slideGeometry(viewer))[0].overflow).toBe("hidden");
  await page.keyboard.press("Enter");
  await expect(viewer).toHaveAccessibleName("Ampliar imagen");
});
