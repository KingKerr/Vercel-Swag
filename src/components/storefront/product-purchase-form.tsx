"use client";

import { useActionState, useId } from "react";

import {
  addToCartAction,
  type AddToCartState,
} from "@/app/actions/cart";

import styles from "@/app/products/[param]/product.module.css";

const initialState: AddToCartState = {
  status: "idle",
  message: "",
};

export function ProductPurchaseForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const quantityId = useId();
  const messageId = useId();

  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );

  const unavailable = stock < 1;

  return (
    <form action={formAction} className={styles.purchaseForm}>
      <input
        type="hidden"
        name="productId"
        value={productId}
      />

      <div className={styles.quantityField}>
        <label htmlFor={quantityId}>Quantity</label>

        <input
          id={quantityId}
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, Math.min(stock, 100))}
          step={1}
          defaultValue={1}
          required
          disabled={pending || unavailable}
          aria-describedby={state.message ? messageId : undefined}
        />
      </div>

      <button
        type="submit"
        className={styles.addButton}
        disabled={pending || unavailable}
      >
        {pending ? "Adding…" : "Add to Cart"}
      </button>

      <p
        id={messageId}
        className={styles.actionMessage}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.message}
      </p>
    </form>
  );
}