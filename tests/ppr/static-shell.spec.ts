import {
  test,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

import { instant } from "@next/playwright";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function rect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected a visible element with a bounding box.");
  }

  return box;
}

function expectSameRect(before: Rect, after: Rect) {
  const tolerance = 1;

  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(
    tolerance,
  );

  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(
    tolerance,
  );

  expect(
    Math.abs(after.width - before.width),
  ).toBeLessThanOrEqual(tolerance);

  expect(
    Math.abs(after.height - before.height),
  ).toBeLessThanOrEqual(tolerance);
}

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.documentWidth,
    `Document width ${dimensions.documentWidth}px exceeds ` +
      `viewport ${dimensions.viewport}px`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("homepage keeps merchandising in the shell and reserves dynamic slots", async ({
  page,
  baseURL,
}) => {
  const hero = page.locator(
    'section[aria-labelledby="hero-title"]',
  );

  const promotionFrame = page.getByTestId("promotion-frame");
  const cartSlot = page.getByTestId("cart-slot");

  let before:
    | {
        hero: Rect;
        promotion: Rect;
        cart: Rect;
      }
    | undefined;

  await instant(
    page,
    async () => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /for the things you build/i,
        }),
      ).toBeVisible();

      await expect(
        page.locator('main a[href^="/products/"]'),
      ).toHaveCount(6);

      await expect(
        page.getByTestId("promotion-loading"),
      ).toBeVisible();

      await expect(
        page.getByTestId("promotion-ready"),
      ).toHaveCount(0);

      await expect(cartSlot).toBeVisible();
      console.log(
        "[PPR cart slot]", 
        await cartSlot.evaluate((element) => ({
          html: element.innerHTML,
          text: element.textContent,

          buttons: Array.from(
            element.querySelectorAll("button"),
          ).map((button) => ({
            text: button.textContent,
            label: button.getAttribute("aria-label"),
            busy: button.getAttribute("aria-busy"),
            disabled: button.disabled,
          })),
        })),
      );
      await page.screenshot({
        path: test.info().outputPath("homepage-shell.png"),
      });

      await expect(
        cartSlot.getByRole("button", {
            name: "Loading cart", 
            exact: true,
        }),
      ).toBeVisible();

      await settleLayout(page);
      await expectNoHorizontalOverflow(page);

      before = {
        hero: await rect(hero),
        promotion: await rect(promotionFrame),
        cart: await rect(cartSlot),
      };
    },
    { baseURL },
  );

  await expect(
    page.getByTestId("promotion-ready"),
  ).toBeVisible();

  await expect(
    cartSlot.getByRole("button", {
      name: /^Cart/,
    }),
  ).toBeEnabled();

  await settleLayout(page);
  await expectNoHorizontalOverflow(page);

  if (!before) {
    throw new Error("Homepage shell measurements were not captured.");
  }

  expectSameRect(before.hero, await rect(hero));
  expectSameRect(before.promotion, await rect(promotionFrame));
  expectSameRect(before.cart, await rect(cartSlot));
});

test("a featured product has cached details before stock resolves", async ({
  page,
  baseURL,
}) => {
  // Discover a route included by our featured-product generation policy.
  await page.goto("/");

  const productLink = page
    .locator('main a[href^="/products/"]')
    .first();

  await expect(productLink).toBeVisible();

  const productPath = await productLink.getAttribute("href");

  if (!productPath) {
    throw new Error("Featured product has no detail-page URL.");
  }

  await page.goto("about:blank");

  let purchaseBefore: Rect | undefined;

  await instant(
    page,
    async () => {
      await page.goto(productPath);

      await expect(
        page.getByRole("heading", { level: 1 }),
      ).toBeVisible();

      await expect(
        page.getByRole("status", {
          name: "Checking availability",
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByTestId("purchase-ready"),
      ).toHaveCount(0);

      await settleLayout(page);
      await expectNoHorizontalOverflow(page);

      purchaseBefore = await rect(
        page.getByTestId("purchase-frame"),
      );
    },
    { baseURL },
  );

  await expect(
    page.getByTestId("purchase-ready"),
  ).toBeVisible();

  await settleLayout(page);
  await expectNoHorizontalOverflow(page);

  if (!purchaseBefore) {
    throw new Error("Purchase-frame measurement was not captured.");
  }

  expectSameRect(
    purchaseBefore,
    await rect(page.getByTestId("purchase-frame")),
  );
});

test("search exposes its shell before URL-dependent results resolve", async ({
  page,
  baseURL,
}) => {
  let resultsBefore: Rect | undefined;

  await instant(
    page,
    async () => {
      await page.goto("/search?q=black&category=bags");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Find your everyday essentials.",
        }),
      ).toBeVisible();

      await expect(
        page.getByTestId("search-controls-frame"),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: "Search results",
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByTestId("search-results-loading"),
      ).toBeVisible();

      await expect(
        page.getByTestId("search-results-ready"),
      ).toHaveCount(0);

      await settleLayout(page);
      await expectNoHorizontalOverflow(page);

      resultsBefore = await rect(
        page.getByTestId("search-results-frame"),
      );
    },
    { baseURL },
  );

  await expect(
    page.getByTestId("search-results-ready"),
  ).toBeVisible();

  await expect(
    page.getByLabel("Search products", { exact: true }),
  ).toHaveValue("black");

  await expect(
    page.getByLabel("Category", { exact: true }),
  ).toHaveValue("bags");

  await settleLayout(page);
  await expectNoHorizontalOverflow(page);

  if (!resultsBefore) {
    throw new Error("Search-frame measurement was not captured.");
  }

  expectSameRect(
    resultsBefore,
    await rect(page.getByTestId("search-results-frame")),
  );
});