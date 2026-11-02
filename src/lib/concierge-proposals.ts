import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import { getCart } from "@/lib/cart-api";
import { readCartToken } from "@/lib/cart-session";
import { getConciergeDb } from "@/lib/concierge-db";
import {
  ensureShopperSession,
  readShopperSession,
} from "@/lib/concierge-session";
import { getProductStock } from "@/lib/swag-api";

const moneySchema = z.number().int().min(0).max(100_000_000);

export const proposalInputSchema = z.object({
  budgetCents: moneySchema,
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(100),
      }).strict(),
    )
    .min(1)
    .max(8)
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size ===
        items.length,
      "Combine duplicate product IDs into one line.",
    ),
}).strict();

const lineSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string(),
  quantity: z.number().int().min(1).max(100),
  unitPriceCents: moneySchema,
  lineTotalCents: moneySchema,
  existingQuantity: z.number().int().nonnegative(),
  stockAtCheck: z.number().int().nonnegative(),
  stockObservedAt: z.string().datetime(),
}).strict();

const linesSchema = z.array(lineSchema).min(1).max(8);

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

export class ProposalInputError extends Error {}

function cartFingerprint(token: string | null) {
  if (!token) {
    return null;
  }

  const secret = process.env.CONCIERGE_CART_BINDING_SECRET;

  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "CONCIERGE_CART_BINDING_SECRET must be 64 hex characters.",
    );
  }

  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`swag-cart:${token}`)
    .digest("hex");
}

export async function readProposalProduct(productId: string) {
  const baseUrl = process.env.SWAG_API_BASE_URL;
  const bypassToken = process.env.SWAG_API_BYPASS_TOKEN;

  if (!baseUrl || !bypassToken) {
    throw new Error("The catalog service is not configured.");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/products/` +
      encodeURIComponent(productId),
    {
      headers: {
        Accept: "application/json",
        "x-vercel-protection-bypass": bypassToken,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to read product details.");
  }

  const payload: unknown = await response.json();
  const product = productResponseSchema.parse(payload).data;

  if (product.id !== productId) {
    throw new ProposalInputError(
      "Use exact product IDs from the catalog, not slugs.",
    );
  }

  return product;
}

export async function createShopperProposal(input: unknown) {
  const parsed = proposalInputSchema.safeParse(input);


  if (!parsed.success) {
    throw new ProposalInputError(
      "Provide a valid budget and one to eight unique product lines.",
    );
  }

  const { budgetCents, items } = parsed.data;

  const token = await readCartToken();
  const fingerprint = cartFingerprint(token);
  const cart = token ? await getCart(token) : null;
  const lines = await Promise.all(
    items.map(async ({ productId, quantity }) => {
      const [product, stock] = await Promise.all([
        readProposalProduct(productId),
        getProductStock(productId),
      ]);

      const existingQuantity =
        cart?.items.find(
          (item) => item.productId === productId,
        )?.quantity ?? 0;

      if (
        !stock.inStock ||
        existingQuantity + quantity > stock.stock
      ) {
        throw new ProposalInputError(
          "A requested quantity is unavailable after accounting " +
            "for the items already in your cart.",
        );
      }

      return lineSchema.parse({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        quantity,
        unitPriceCents: product.price,
        lineTotalCents: product.price * quantity,
        existingQuantity,
        stockAtCheck: stock.stock,
        stockObservedAt: new Date().toISOString(),
      });
    }),
  );

  const subtotalCents = lines.reduce(
    (total, line) => total + line.lineTotalCents,
    0,
  );

  if (subtotalCents > budgetCents) {
    throw new ProposalInputError(
      "The current merchandise subtotal exceeds the budget.",
    );
  }

  const session = await ensureShopperSession();
  const sql = getConciergeDb();
  const snapshot = JSON.stringify(lines);

  const rows = await sql`
    INSERT INTO concierge.proposals (
      session_id,
      budget_cents,
      subtotal_cents,
      items,
      cart_fingerprint,
      expires_at
    )
    SELECT
      s.id,
      ${budgetCents},
      ${subtotalCents},
      ${snapshot}::jsonb,
      ${fingerprint},
      now() + interval '15 minutes'
    FROM concierge.sessions AS s
    WHERE s.id = ${session.id}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    RETURNING id
  `;

  if (!rows[0]) {
    throw new Error("The shopper session expired.");
  }

  return {
    proposalId: z.string().uuid().parse(rows[0].id),
  };
}

export async function readShopperProposal(proposalId: string) {
  if (!z.string().uuid().safeParse(proposalId).success) {
    return null;
  }

  const session = await readShopperSession();

  if (!session) {
    return null;
  }

  const sql = getConciergeDb();

  const rows = await sql`
    SELECT
      p.id,
      p.budget_cents,
      p.subtotal_cents,
      p.items,
      p.cart_fingerprint,
      p.expires_at::text AS expires_at
    FROM concierge.proposals AS p
    JOIN concierge.sessions AS s
      ON s.id = p.session_id
    WHERE p.id = ${proposalId}
      AND p.session_id = ${session.id}
      AND p.expires_at > now()
      AND s.expires_at > now()
      AND s.revoked_at IS NULL
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const currentToken = await readCartToken();

  return {
    id: z.string().uuid().parse(row.id),
    budgetCents: moneySchema.parse(Number(row.budget_cents)),
    subtotalCents: moneySchema.parse(Number(row.subtotal_cents)),
    items: linesSchema.parse(row.items),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    cartIdentityMatches:
      row.cart_fingerprint === cartFingerprint(currentToken),
  };
}