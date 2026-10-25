"use client";

import Image from "next/image";
import {
  useActionState,
  useId,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  editCartAction,
  resetExpiredCartAction,
} from "@/app/actions/cart";
import type { CartSummary } from "@/lib/cart-api";

import styles from "./cart-drawer.module.css";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function CartDrawer({
  cart,
  status,
}: {
  cart: CartSummary | null;
  status: "ready" | "expired" | "error";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  function refreshCart() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function openCart() {
    dialogRef.current?.showModal();
    refreshCart();
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        onClick={openCart}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 7h14l1 14H4L5 7Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>

        Cart

        <span className={styles.badge}>
          {status === "ready" ? cart?.totalItems ?? 0 : "—"}
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.drawer}
        aria-labelledby={headingId}
      >
        <div className={styles.header}>
          <h2 id={headingId}>Your cart</h2>

          <button
            type="button"
            className={styles.close}
            onClick={() => dialogRef.current?.close()}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.refreshRow}>
            <span role="status">
              {refreshing ? "Refreshing cart…" : "Session cart"}
            </span>

            <button
              type="button"
              className={styles.textButton}
              onClick={refreshCart}
              disabled={refreshing}
            >
              Refresh
            </button>
          </div>

          {status === "error" ? (
            <p>
              We couldn’t load your cart. Refresh to try again.
              Your session has not been cleared.
            </p>
          ) : status === "expired" ? (
            <ExpiredCart />
          ) : !cart || cart.items.length === 0 ? (
            <div className={styles.empty}>
              <h3>Your cart is empty</h3>
              <p>Find something worth shipping.</p>
              <button
                type="button"
                className={styles.button}
                onClick={() => dialogRef.current?.close()}
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <>
              <ul className={styles.items}>
                {cart.items.map((item) => (
                  <CartItem
                    key={`${item.productId}:${item.quantity}`}
                    item={item}
                    currency={cart.currency}
                    disabled={refreshing}
                  />
                ))}
              </ul>

              <div className={styles.summary}>
                <span>Subtotal</span>
                <span>{money(cart.subtotal, cart.currency)}</span>
              </div>

              <p className={styles.note}>
                Demo storefront. Checkout is not implemented.
              </p>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

function CartItem({
  item,
  currency,
  disabled,
}: {
  item: CartSummary["items"][number];
  currency: string;
  disabled: boolean;
}) {
  const quantityId = useId();
  const [state, action, pending] = useActionState(
    editCartAction,
    { message: "" },
  );

  return (
    <li className={styles.item}>
      <div className={styles.image}>
        <Image
          src={item.product.images[0]}
          alt={item.product.name}
          fill
          sizes="88px"
          className={styles.photo}
        />
      </div>

      <div className={styles.itemDetails}>
        <h3>{item.product.name}</h3>
        <p>{money(item.product.price, currency)} each</p>

        <form action={action}>
          <input
            type="hidden"
            name="productId"
            value={item.productId}
          />

          <fieldset
            disabled={pending || disabled}
            className={styles.controls}
          >
            <label htmlFor={quantityId}>Quantity</label>

            <input
              id={quantityId}
              type="number"
              name="quantity"
              min={1}
              max={100}
              step={1}
              defaultValue={item.quantity}
              required
            />

            <button
              type="submit"
              name="intent"
              value="update"
              className={styles.textButton}
            >
              {pending ? "Saving…" : "Update"}
            </button>

            <button
              type="submit"
              name="intent"
              value="remove"
              formNoValidate
              className={styles.textButton}
            >
              Remove
            </button>
          </fieldset>

          <p className={styles.message} role="status">
            {state.message}
          </p>
        </form>

        <p className={styles.lineTotal}>
          {money(item.lineTotal, currency)}
        </p>
      </div>
    </li>
  );
}

function ExpiredCart() {
  const [state, action, pending] = useActionState(
    resetExpiredCartAction,
    { message: "" },
  );

  return (
    <div className={styles.empty}>
      <h3>Your cart session has expired</h3>
      <p>Clear the expired session to begin a new cart.</p>

      <form action={action}>
        <button
          type="submit"
          className={styles.button}
          disabled={pending}
        >
          {pending ? "Resetting…" : "Start a new cart"}
        </button>

        <p role="status">{state.message}</p>
      </form>
    </div>
  );
}