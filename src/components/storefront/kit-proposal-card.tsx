"use client";

import Link from "next/link";
import { useActionState } from "react";
import { z } from "zod";

import {
  prepareProposalAction,
  type PrepareProposalState,
} from "@/app/actions/concierge";

const kitSchema = z.object({
  passesBudgetAndStockChecks: z.literal(true),
  budgetCents: z.number().int().min(0).max(100_000_000),
  subtotalCents: z.number().int().min(0).max(100_000_000),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(200),
        name: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
        lineTotalCents: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(8),
});

const initialState: PrepareProposalState = {
  status: "idle",
  message: "",
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function KitProposalCard({
  output,
  disabled = false,
}: {
  output: unknown;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    prepareProposalAction,
    initialState,
  );

  const parsed = kitSchema.safeParse(output);

  if (!parsed.success) {
    return null;
  }

  const kit = parsed.data;

  const payload = JSON.stringify({
    budgetCents: kit.budgetCents,
    items: kit.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
  });

  return (
    <section
      aria-labelledby="kit-review-title"
      style={{
        marginBlock: 24,
        padding: 20,
        border: "1px solid #cfcfd6",
        borderRadius: 8,
      }}
    >
      <h2 id="kit-review-title">Proposed kit</h2>

      <ul>
        {kit.lines.map((line) => (
          <li key={line.productId}>
            {line.quantity} × {line.name}
            {" — "}
            {usd.format(line.lineTotalCents / 100)}
          </li>
        ))}
      </ul>

      <p>
        Checked merchandise subtotal:{" "}
        {usd.format(kit.subtotalCents / 100)}
      </p>

      <p>
        Prices and availability will be checked again when
        preparing the review. Nothing has been reserved or
        added to your cart.
      </p>

      {state.status === "success" && state.proposalId ? (
        <Link href={`/concierge/review/${state.proposalId}`}>
          Open your prepared review
        </Link>
      ) : (
        <form action={formAction}>
          <input
            type="hidden"
            name="payload"
            value={payload}
          />

          <button
            type="submit"
            disabled={disabled || pending}
            aria-busy={pending}
            style={{
              minHeight: 44,
              padding: "12px 20px",
            }}
          >
            {pending ? "Preparing review…" : "Review this kit"}
          </button>
        </form>
      )}

      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}