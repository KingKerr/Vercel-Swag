import {
  test,
  expect,
  type Page,
} from "@playwright/test";

function productLinks(page: Page) {
  return page.locator('main a[href^="/products/"]');
}

test("homepage displays at least six correctly contained products", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /for the things you build/i,
    }),
  ).toBeVisible();

  await expect
    .poll(() => productLinks(page).count())
    .toBeGreaterThanOrEqual(6);

  const firstProduct = productLinks(page).first();
  const image = firstProduct.locator("img");

  await expect(image).toBeVisible();

  const wrapper = image.locator("..");

  await expect(wrapper).toHaveCSS("position", "relative");

  const box = await wrapper.boundingBox();

  expect(box).not.toBeNull();

  if (!box) {
    throw new Error("Product image wrapper has no bounding box.");
  }

  expect(box.width).toBeGreaterThan(0);
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);

  const grid = firstProduct.locator("xpath=ancestor::ul[1]");

  await expect(grid).toHaveCSS("display", "grid");
});

test("a featured product opens a detail page with purchase controls", async ({
  page,
}) => {
  await page.goto("/");

  const firstProduct = productLinks(page).first();
  const href = await firstProduct.getAttribute("href");

  expect(href).toBeTruthy();

  await firstProduct.click();

  await expect(page).toHaveURL(
    new RegExp(`${href?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  );

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Add to Cart",
      exact: true,
    }),
  ).toBeVisible();

  const quantity = page.getByRole("spinbutton", {
    name: "Quantity",
  });

  await expect(quantity).toHaveValue("1");
});

test("search submits query and category into the URL", async ({
  page,
}) => {
  await page.goto("/search");

  await page.getByLabel("Search products").fill("black");

  await page
    .getByLabel("Category", { exact: true })
    .selectOption("bags");

  await page.getByRole("button", {
    name: "Search",
    exact: true,
  }).click();

  await expect(page).toHaveURL(
    /\/search\?.*q=black.*category=bags/,
  );

  await expect(
    page.getByRole("heading", {
      name: "Search results",
      exact: true,
    }),
  ).toBeVisible();

  expect(await productLinks(page).count()).toBeLessThanOrEqual(5);

  await page.reload();

  await expect(page.getByLabel("Search products")).toHaveValue(
    "black",
  );

  await expect(
    page.getByLabel("Category", { exact: true }),
  ).toHaveValue("bags");
});

test("search distinguishes an empty result from a loading state", async ({
  page,
}) => {
  await page.goto(
    "/search?q=zz-no-product-9f8c2b7e-unmatchable",
  );

  await expect(
    page.getByRole("heading", {
      name: "No matching products",
      exact: true,
    }),
  ).toBeVisible();

  await expect(productLinks(page)).toHaveCount(0);
});

test("invalid category displays validation instead of querying it", async ({
  page,
}) => {
  await page.goto("/search?category=not-a-real-category");

  await expect(
    page.getByText(
      "That category is not available. Choose another category.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("empty cart opens, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.goto("/");

  const trigger = page.getByRole("button", {
    name: /^Cart\b/,
  });

  await trigger.click();

  const dialog = page.getByRole("dialog", {
    name: "Your cart",
  });

  await expect(dialog).toBeVisible();

  await expect(
    dialog.getByRole("heading", {
      name: "Your cart is empty",
    }),
  ).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("mobile storefront does not overflow horizontally", async ({
  page,
}) => {
  await page.setViewportSize({
    width: 375,
    height: 812,
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toBeVisible();

  await expect
    .poll(() => productLinks(page).count())
    .toBeGreaterThanOrEqual(6);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
});