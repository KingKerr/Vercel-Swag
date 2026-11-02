import "server-only";

import { z } from "zod";

import {
  addCartItem,
  createCart,
  getCart,
  type CartSummary,
} from "@/lib/cart-api";
import {
  readCartToken,
  saveCartToken,
} from "@/lib/cart-session";
import { getConciergeDb } from "@/lib/concierge-db";
import {
  readProposalProduct,
  readShopperProposal,
} from "@/lib/concierge-proposals";
import { readShopperSession } from "@/lib/concierge-session";
import { getProductStock } from "@/lib/swag-api";
import { reserveConciergeUsage } from "../../shared/concierge-usage";

export type CommitProposalResult = {
  status: "success" | "error" | "review";
  message: string;
  locked: boolean;
};

function cartSignature(cart: CartSummary | null) {
  return JSON.stringify(
    (cart?.items ?? [])
      .map((item) => [
        item.productId,
        item.quantity,
        item.product.price,
      ])
      .sort((a, b) =>
        String(a[0]).localeCompare(String(b[0])),
      ),
  );
}

export async function commitShopperProposal(
  proposalId: string,
): Promise<CommitProposalResult> {
  if (!z.string().uuid().safeParse(proposalId).success) {
    return {
      status: "error",
      message: "Invalid proposal.",
      locked: false,
    };
  }

  const session = await readShopperSession();

  if (!session) {
    return {
      status: "error",
      message: "Your shopper session has expired.",
      locked: true,
    };
  }

  const proposal = await readShopperProposal(proposalId);

  if (!proposal || !proposal.cartIdentityMatches) {
    return {
      status: "error",
      message:
        "This proposal expired, is unavailable, or belongs " +
        "to a different cart session. Prepare a new proposal.",
      locked: true,
    };
  }
  const allowed = await reserveConciergeUsage(
    "commit", 
    session.id,
  ); 
  if (!allowed) {
    return {
        status: "error",
        message:
          "This demo's cart-operation allowance has been reached. " + 
          "No new operation was started. ",
          locked: true,
    };
  }

  const sql = getConciergeDb();

  // Claim the proposal and create all line records in one statement.
  // A competing request receives no rows and must not execute.
  const claimed = await sql`
    WITH eligible AS (
      SELECT p.id, p.session_id, p.items
      FROM concierge.proposals AS p
      JOIN concierge.sessions AS s
        ON s.id = p.session_id
      WHERE p.id = ${proposalId}
        AND p.session_id = ${session.id}
        AND p.expires_at > now()
        AND s.expires_at > now()
        AND s.revoked_at IS NULL
    ),
    operation AS (
      INSERT INTO concierge.operations (
        proposal_id,
        session_id
      )
      SELECT id, session_id
      FROM eligible
      ON CONFLICT DO NOTHING
      RETURNING id, proposal_id
    )
    INSERT INTO concierge.operation_items (
      operation_id,
      line_number,
      product_id,
      quantity,
      unit_price_cents
    )
    SELECT
      operation.id,
      entry.ordinality::integer,
      entry.item->>'productId',
      (entry.item->>'quantity')::integer,
      (entry.item->>'unitPriceCents')::bigint
    FROM operation
    JOIN eligible
      ON eligible.id = operation.proposal_id
    CROSS JOIN LATERAL
      jsonb_array_elements(eligible.items)
      WITH ORDINALITY AS entry(item, ordinality)
    RETURNING operation_id
  `;

  if (claimed.length === 0) {
    return {
      status: "review",
      message:
        "This proposal was already submitted, expired, or another " +
        "cart operation is unresolved. Check your cart before continuing.",
      locked: true,
    };
  }

  const operationId = z.string().uuid().parse(
    claimed[0].operation_id,
  );

  let mutationAttempted = false;
  let confirmedLines = 0;

  try {
    let token = await readCartToken();
    let cart = token ? await getCart(token) : null;

    // Refuse a proposal whose existing quantities have changed.
    for (const line of proposal.items) {
      const currentQuantity =
        cart?.items.find(
          (item) => item.productId === line.productId,
        )?.quantity ?? 0;

      if (currentQuantity !== line.existingQuantity) {
        throw new Error("Cart quantities changed.");
      }
    }

    // Check every line before making any cart mutation.
    for (const line of proposal.items) {
      const [product, stock] = await Promise.all([
        readProposalProduct(line.productId),
        getProductStock(line.productId),
      ]);

      if (
        product.price !== line.unitPriceCents ||
        !stock.inStock ||
        line.existingQuantity + line.quantity > stock.stock
      ) {
        throw new Error("Price or availability changed.");
      }
    }

    await sql`
      UPDATE concierge.operations
      SET status = 'running', updated_at = now()
      WHERE id = ${operationId}
        AND status = 'claimed'
    `;

    if (!token) {
      mutationAttempted = true;
      token = await createCart();
      await saveCartToken(token);
      cart = await getCart(token);

      if (cart.items.length !== 0) {
        throw new Error("Unexpected new cart contents.");
      }
    }

    let expectedCartSignature = cartSignature(cart);

    for (const [index, line] of proposal.items.entries()) {
      const lineNumber = index + 1;

      // Detect intervening cart changes before each addition.
      const latestCart = await getCart(token);

      if (
        cartSignature(latestCart) !== expectedCartSignature
      ) {
        throw new Error("Cart changed during execution.");
      }

      const existingQuantity =
        latestCart.items.find(
          (item) => item.productId === line.productId,
        )?.quantity ?? 0;

      const [product, stock] = await Promise.all([
        readProposalProduct(line.productId),
        getProductStock(line.productId),
      ]);

      if (
        product.price !== line.unitPriceCents ||
        !stock.inStock ||
        existingQuantity + line.quantity > stock.stock
      ) {
        throw new Error("Price or availability changed.");
      }

      // Persist intent before sending the external mutation.
      const attempting = await sql`
        UPDATE concierge.operation_items
        SET
          status = 'attempting',
          baseline_quantity = ${existingQuantity},
          attempt_started_at = now()
        WHERE operation_id = ${operationId}
          AND line_number = ${lineNumber}
          AND status = 'pending'
        RETURNING line_number
      `;

      if (attempting.length !== 1) {
        throw new Error("Line is not eligible for execution.");
      }

      mutationAttempted = true;

      const updatedCart = await addCartItem(
        token,
        line.productId,
        line.quantity,
      );

      const updatedItem = updatedCart.items.find(
        (item) => item.productId === line.productId,
      );

      const expectedQuantity =
        existingQuantity + line.quantity;

      if (
        !updatedItem ||
        updatedItem.quantity !== expectedQuantity ||
        updatedItem.product.price !== line.unitPriceCents
      ) {
        throw new Error("Unexpected cart response.");
      }

      await sql`
        UPDATE concierge.operation_items
        SET
          status = 'succeeded',
          confirmed_quantity = ${updatedItem.quantity},
          finished_at = now(),
          outcome_code = 'addition_confirmed'
        WHERE operation_id = ${operationId}
          AND line_number = ${lineNumber}
          AND status = 'attempting'
      `;

      confirmedLines += 1;
      expectedCartSignature = cartSignature(updatedCart);
    }

    await sql`
      UPDATE concierge.operations
      SET
        status = 'succeeded',
        outcome_code = 'all_additions_confirmed',
        updated_at = now(),
        finished_at = now()
      WHERE id = ${operationId}
        AND status = 'running'
    `;

    return {
      status: "success",
      message:
        "The reviewed additions were confirmed in your cart. " +
        "No purchase was made.",
      locked: true,
    };
  } catch {
    // Never automatically replay an attempted upstream mutation.
    try {
      await sql.transaction([
        sql`
          UPDATE concierge.operation_items
          SET
            status = 'uncertain',
            outcome_code = 'confirmation_required'
          WHERE operation_id = ${operationId}
            AND status = 'attempting'
        `,
        sql`
          UPDATE concierge.operation_items
          SET
            status = 'skipped',
            outcome_code = 'execution_stopped',
            finished_at = now()
          WHERE operation_id = ${operationId}
            AND status = 'pending'
        `,
        sql`
          UPDATE concierge.operations
          SET
            status = ${
              mutationAttempted ? "needs_review" : "failed"
            },
            outcome_code = ${
              mutationAttempted
                ? "cart_confirmation_required"
                : "preflight_failed"
            },
            updated_at = now(),
            finished_at = ${
              mutationAttempted
                ? null
                : new Date().toISOString()
            }::timestamptz
          WHERE id = ${operationId}
        `,
      ]);
    } catch {
      // A claimed/running operation remains blocked if recording fails.
      // Do not retry the cart write to compensate.
    }

    return mutationAttempted
      ? {
          status: "review",
          message:
            `${confirmedLines} product line(s) were confirmed before ` +
            "execution stopped. Another change may have occurred. " +
            "Inspect your cart; do not resubmit the kit.",
          locked: true,
        }
      : {
          status: "error",
          message:
            "Nothing was added by this operation. Cart state, price, " +
            "availability, or a required service check changed. " +
            "Prepare a fresh proposal.",
          locked: true,
        };
  }
}

const operationStatusSchema = z.enum([
  "claimed",
  "running",
  "succeeded",
  "failed",
  "needs_review",
]);

const operationItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  status: z.enum([
    "pending",
    "attempting",
    "succeeded",
    "failed",
    "uncertain",
    "skipped",
  ]),
});

export async function readShopperOperation(
  proposalId: string,
) {
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
      o.id,
      o.status,
      i.product_id,
      i.quantity,
      i.status AS item_status
    FROM concierge.operations AS o
    JOIN concierge.sessions AS s
      ON s.id = o.session_id
    JOIN concierge.operation_items AS i
      ON i.operation_id = o.id
    WHERE o.proposal_id = ${proposalId}
      AND o.session_id = ${session.id}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    ORDER BY i.line_number
  `;

  if (rows.length === 0) {
    return null;
  }

  return {
    id: z.string().uuid().parse(rows[0].id),
    status: operationStatusSchema.parse(rows[0].status),
    items: rows.map((row) =>
      operationItemSchema.parse({
        productId: row.product_id,
        quantity: Number(row.quantity),
        status: row.item_status,
      }),
    ),
  };
}