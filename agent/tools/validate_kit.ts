import { defineTool } from "eve/tools";
import { z } from "zod";

const moneySchema = z.number().int().min(0).max(100_000_000);

const inputSchema = z.object({
  budgetCents: moneySchema.describe(
    "The shopper's maximum merchandise subtotal in USD cents. " +
      "For example, $75 is 7500. Excludes tax, shipping, and discounts.",
  ),

  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(160),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(8)
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size ===
        items.length,
      {
        message:
          "Use one entry per product ID; combine duplicate quantities.",
      },
    ),
});

const productResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    category: z.string(),
    price: moneySchema,
    currency: z.literal("USD"),
  }),
});

const stockResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    productId: z.string().min(1),
    stock: z.number().int().nonnegative(),
    inStock: z.boolean(),
    lowStock: z.boolean(),
  }),
});

export default defineTool({
  description:
    "Validate a proposed kit using current product prices and fresh " +
    "stock reads. Checks requested quantities and a merchandise-only " +
    "USD budget. Use product IDs from search_catalog. Does not reserve " +
    "stock, modify a cart, apply discounts, or calculate tax/shipping. " +
    "A passing result does not validate preferences such as no clothing.",

  inputSchema,

  label: {
    start: () => "Checking kit prices, quantities, and stock",
  },

  async execute({ budgetCents, items }, ctx) {
    const baseUrl = process.env.SWAG_API_BASE_URL;
    const bypassToken = process.env.SWAG_API_BYPASS_TOKEN;

    if (!baseUrl || !bypassToken) {
      throw new Error("The catalog service is not configured.");
    }

    const controller = new AbortController();

    const signal = AbortSignal.any([
      ctx.abortSignal,
      controller.signal,
      AbortSignal.timeout(20_000),
    ]);

    const validationStartedAt = new Date().toISOString();

    async function read(path: string): Promise<unknown> {
      const response = await fetch(
        `${baseUrl!.replace(/\/$/, "")}${path}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "x-vercel-protection-bypass": bypassToken!,
          },
          cache: "no-store",
          signal,
        },
      );

      if (!response.ok) {
        throw new Error("Catalog read failed.");
      }

      return response.json();
    }

    try {
      const lines = await Promise.all(
        items.map(async ({ productId, quantity }) => {
          const encodedId = encodeURIComponent(productId);

          const [productPayload, stockPayload] = await Promise.all([
            read(`/products/${encodedId}`),
            read(`/products/${encodedId}/stock`),
          ]);

          const product = productResponseSchema.parse(
            productPayload,
          ).data;

          const stock = stockResponseSchema.parse(
            stockPayload,
          ).data;

          if (
            product.id !== productId ||
            stock.productId !== product.id
          ) {
            throw new Error("Product identity mismatch.");
          }

          const quantityAvailable =
            stock.inStock && stock.stock >= quantity;

          return {
            productId: product.id,
            name: product.name,
            category: product.category,
            productPath:
              `/products/${encodeURIComponent(product.slug)}`,
            quantity,
            unitPriceCents: product.price,
            lineTotalCents: product.price * quantity,
            stockAtCheck: stock.stock,
            lowStock: stock.lowStock,
            quantityAvailable,
            stockObservedAt: new Date().toISOString(),
          };
        }),
      );

      const subtotalCents = lines.reduce(
        (total, line) => total + line.lineTotalCents,
        0,
      );

      const withinBudget = subtotalCents <= budgetCents;
      const quantitiesAvailable = lines.every(
        (line) => line.quantityAvailable,
      );

      return {
        validationScope: "merchandise_budget_and_stock_snapshot",
        currency: "USD",
        budgetCents,
        subtotalCents,
        remainingBudgetCents: Math.max(
          0,
          budgetCents - subtotalCents,
        ),
        overBudgetCents: Math.max(
          0,
          subtotalCents - budgetCents,
        ),
        withinBudget,
        quantitiesAvailable,
        passesBudgetAndStockChecks:
          withinBudget && quantitiesAvailable,
        lines,
        validationStartedAt,
        validationCompletedAt: new Date().toISOString(),
        stockReserved: false,
        cartModified: false,
        taxIncluded: false,
        shippingIncluded: false,
        discountsApplied: false,
        preferencesValidated: false,
      };
    } catch {
      if (ctx.abortSignal.aborted) {
        throw new Error("Kit validation was cancelled.");
      }

      throw new Error(
        "Kit validation could not complete. One or more product " +
          "or stock reads failed, timed out, or returned invalid data. " +
          "Do not claim that the kit passed validation.",
      );
    } finally {
      controller.abort();
    }
  },
});