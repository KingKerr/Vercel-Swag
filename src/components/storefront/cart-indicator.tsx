import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

import {
  getCart,
  type CartSummary,
} from "@/lib/cart-api";
import { readCartToken } from "@/lib/cart-session";
import { SwagApiError } from "@/lib/swag-api";

import { CartDrawer } from "./cart-drawer";

export async function CartIndicator() {
  await connection();

  const token = await readCartToken();

  let cart: CartSummary | null = null;
  let status: "ready" | "expired" | "error" = "ready";

  if (token) {
    try {
      cart = await getCart(token);
    } catch (error) {
      unstable_rethrow(error);

      if (
        error instanceof SwagApiError &&
        error.status === 404
      ) {
        status = "expired";
      } else {
        status = "error";

        console.error(
          "[storefront/cart] Read failed:",
          error,
        );
      }
    }
  }

  return <CartDrawer cart={cart} status={status} />;
}