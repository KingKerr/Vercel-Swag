import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string(),
  price: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  images: z.array(z.string().url()).min(1),
});

const productListSchema = z.object({
  success: z.literal(true),
  data: z.array(productSchema),
});

const promotionSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    code: z.string().optional(),
    active: z.boolean(),
  }),
});

export type StorefrontProduct = z.infer<typeof productSchema>;

export class SwagApiError extends Error {
  constructor(public readonly status: number) {
    super(`Swag Store API returned HTTP ${status}.`);
    this.name = "SwagApiError";
  }
}

async function request(path: string): Promise<unknown> {
  const baseUrl = process.env.SWAG_API_BASE_URL;
  const bypassToken = process.env.SWAG_API_BYPASS_TOKEN;

  if (!baseUrl || !bypassToken) {
    throw new Error("Missing Swag Store API environment variables.");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}${path}`,
    {
      headers: {
        Accept: "application/json",
        "x-vercel-protection-bypass": bypassToken,
      },
    },
  );

  if (!response.ok) {
    throw new SwagApiError(response.status);
  }

  return response.json();
}

export async function getFeaturedProducts() {
  "use cache";

  cacheLife("hours");
  cacheTag("featured-products");

  const payload = await request("/products?featured=true&limit=6");
  const result = productListSchema.parse(payload);

  if (result.data.length < 6) {
    throw new Error(
      "The API returned fewer than the six required featured products.",
    );
  }

  return result.data;
}

export async function getActivePromotion() {
  const payload = await request("/promotions");
  const result = promotionSchema.parse(payload);

  return result.data.active ? result.data : null;
}

export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

const productResponseSchema = z.object({
  success: z.literal(true),
  data: productSchema,
});

const stockResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    productId: z.string(),
    stock: z.number().int().nonnegative(),
    inStock: z.boolean(),
    lowStock: z.boolean(),
  }),
});

export async function getProductBySlug(slug: string) {
  "use cache";

  cacheLife("hours");
  cacheTag(`product:${slug}`);

  try {
    const payload = await request(
      `/products/${encodeURIComponent(slug)}`,
    );

    return productResponseSchema.parse(payload).data;
  } catch (error) {
    if (error instanceof SwagApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getProductStock(productId: string) {
  const payload = await request(
    `/products/${encodeURIComponent(productId)}/stock`,
  );

  return stockResponseSchema.parse(payload).data;
}

const categoriesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      productCount: z.number().int().nonnegative(),
    }),
  ),
});

export async function getCategories() {
  "use cache";

  cacheLife("hours");
  cacheTag("categories");

  const payload = await request("/categories");

  return categoriesResponseSchema.parse(payload).data;
}

export async function searchProducts({
  query,
  category,
}: {
  query: string;
  category: string;
}) {
  const params = new URLSearchParams({
    limit: "5",
  });

  if (query) {
    params.set("search", query);
  }

  if (category) {
    params.set("category", category);
  }

  const payload = await request(`/products?${params.toString()}`);

  return productListSchema.parse(payload).data;
}