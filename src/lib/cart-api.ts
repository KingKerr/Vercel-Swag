import "server-only";

import { z } from "zod";

import { SwagApiError } from "./swag-api";

const cartSummarySchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        lineTotal: z.number().int().nonnegative(),
        product: z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          price: z.number().int().nonnegative(),
          currency: z.literal("USD"),
          images: z.array(z.string().url()).min(1),
        }),
      }),
    ),
    totalItems: z.number().int().nonnegative(),
    subtotal: z.number().int().nonnegative(),
    currency: z.literal("USD"),
  }),
});

export type CartSummary = z.infer<
  typeof cartSummarySchema
>["data"];

async function cartRequest(
  path: string,
  init: RequestInit = {},
  token?: string,
) {
  const baseUrl = process.env.SWAG_API_BASE_URL;
  const bypassToken = process.env.SWAG_API_BYPASS_TOKEN;

  if (!baseUrl || !bypassToken) {
    throw new Error("Missing Swag Store API environment variables.");
  }

  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  headers.set("x-vercel-protection-bypass", bypassToken);

  if (token) {
    headers.set("x-cart-token", token);
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}${path}`,
    {
      ...init,
      headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new SwagApiError(response.status);
  }

  return response;
}

export async function createCart() {
  const response = await cartRequest("/cart/create", {
    method: "POST",
  });

  const token = z
    .string()
    .uuid()
    .parse(response.headers.get("x-cart-token"));

  return token;
}

export async function getCart(token: string): Promise<CartSummary> {
  const response = await cartRequest("/cart", {}, token);
  const payload: unknown = await response.json();

  return cartSummarySchema.parse(payload).data;
}

export async function addCartItem(
  token: string,
  productId: string,
  quantity: number,
): Promise<CartSummary> {
  const response = await cartRequest(
    "/cart",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, quantity }),
    },
    token,
  );

  const payload: unknown = await response.json();

  return cartSummarySchema.parse(payload).data;
}

export async function updateCartItem(
  token: string,
  productId: string,
  quantity: number,
): Promise<CartSummary> {
  const response = await cartRequest(
    `/cart/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity }),
    },
    token,
  );

  const payload: unknown = await response.json();

  return cartSummarySchema.parse(payload).data;
}

export async function removeCartItem(
  token: string,
  productId: string,
): Promise<CartSummary> {
  const response = await cartRequest(
    `/cart/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
    token,
  );

  const payload: unknown = await response.json();

  return cartSummarySchema.parse(payload).data;
}