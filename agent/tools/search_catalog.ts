import { defineTool } from "eve/tools";
import { z } from "zod";

const categorySchema = z.enum([
  "bottles",
  "cups",
  "mugs",
  "desk",
  "stationery",
  "accessories",
  "bags",
  "hats",
  "t-shirts",
  "hoodies",
  "socks",
  "tech",
  "books",
]);

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string(),
  price: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  category: z.string(),
  images: z.array(z.string().url()),
});

const responseSchema = z.object({
  success: z.literal(true),
  data: z.array(productSchema),
});

export default defineTool({
  description:
    "Search the actual Vercel Swag Store catalog by a concise search " +
    "term and/or category. Returns at most eight products with prices " +
    "in USD cents. This tool does not check inventory, apply discounts, " +
    "or read or modify a cart. Results may be only a subset of matches.",

  inputSchema: z.object({
    query: z.string().trim().max(120).optional(),
    category: categorySchema.optional(),
  }),

  label: {
    start: ({ query, category }) =>
      query
        ? `Searching catalog for “${query}”`
        : category
          ? `Browsing ${category}`
          : "Browsing the catalog",
  },

  async execute({ query, category }, ctx) {
    const baseUrl = process.env.SWAG_API_BASE_URL;
    const bypassToken = process.env.SWAG_API_BYPASS_TOKEN;

    if (!baseUrl || !bypassToken) {
      throw new Error("The catalog service is not configured.");
    }

    const params = new URLSearchParams({
      limit: "8",
    });

    if (query) {
      params.set("search", query);
    }

    if (category) {
      params.set("category", category);
    }

    const signal = AbortSignal.any([
      ctx.abortSignal,
      AbortSignal.timeout(10_000),
    ]);

    let response: Response;

    try {
      response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/products?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "x-vercel-protection-bypass": bypassToken,
          },
          signal,
        },
      );
    } catch (error) {
      if (ctx.abortSignal.aborted) {
        throw error;
      }

      throw new Error(
        "The catalog request could not complete. Do not invent products.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `The catalog service returned HTTP ${response.status}. ` +
          "Do not substitute invented catalog results.",
      );
    }

    const payload: unknown = await response.json();
    const result = responseSchema.safeParse(payload);

    if (!result.success) {
      throw new Error(
        "The catalog response did not match the expected format.",
      );
    }

    return {
      products: result.data.data.map((product) => ({
        ...product,
        productPath: `/products/${encodeURIComponent(product.slug)}`,
      })),
      returnedCount: result.data.data.length,
      resultLimit: 8,
      inventoryChecked: false,
      completeCatalogSearch: false,
    };
  },
});