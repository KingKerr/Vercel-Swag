"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  addCartItem,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart-api";
import {
  clearCartToken,
  readCartToken,
  saveCartToken,
} from "@/lib/cart-session";
import {
  getProductStock,
  SwagApiError,
} from "@/lib/swag-api";

export type AddToCartState = {
  status: "idle" | "success" | "error";
  message: string;
};

const inputSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(100),
});

export async function addToCartAction(
  _previousState: AddToCartState,
  formData: FormData,
): Promise<AddToCartState> {
  const parsed = inputSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose a valid quantity between 1 and 100.",
    };
  }

  const { productId, quantity } = parsed.data;

  try {
    let token = await readCartToken();

    const currentCart = token ? await getCart(token) : null;

    const existingQuantity =
      currentCart?.items.find(
        (item) => item.productId === productId,
      )?.quantity ?? 0;

    const stock = await getProductStock(productId);

    if (
      !stock.inStock ||
      existingQuantity + quantity > stock.stock
    ) {
      return {
        status: "error",
        message:
          "Availability has changed, or your cart already contains the available quantity. Refresh the page and review your selection.",
      };
    }

    if (!token) {
      token = await createCart();
      await saveCartToken(token);
    }

    await addCartItem(token, productId, quantity);
  } catch (error) {
    unstable_rethrow(error);

    console.error("[storefront/cart] Add item failed:", error);

    if (error instanceof SwagApiError && error.status === 404) {
      return {
        status: "error",
        message:
          "The cart or product is no longer available. Your cart may have expired.",
      };
    }

    return {
      status: "error",
      message:
        "We couldn’t confirm the cart update. Check your cart count before trying again.",
    };
  }

  refresh();

  return {
    status: "success",
    message: `Added ${quantity} ${
      quantity === 1 ? "item" : "items"
    } to your cart.`,
  };
}

export type CartEditState = {
  message: string;
};

const editSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  intent: z.enum(["update", "remove"]),
});

export async function editCartAction(
  _previousState: CartEditState,
  formData: FormData,
): Promise<CartEditState> {
  const parsed = editSchema.safeParse({
    productId: formData.get("productId"),
    intent: formData.get("intent"),
  });

  if (!parsed.success) {
    return { message: "Invalid cart request." };
  }

  const { productId, intent } = parsed.data;

  const quantityResult = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .safeParse(formData.get("quantity"));

  if (intent === "update" && !quantityResult.success) {
    return {
      message: "Choose a whole-number quantity between 1 and 100.",
    };
  }

  try {
    const token = await readCartToken();

    if (!token) {
      return { message: "Your cart session is no longer available." };
    }

    const cart = await getCart(token);
    const item = cart.items.find(
      (entry) => entry.productId === productId,
    );

    if (!item) {
      return {
        message: "This item is no longer in your cart. Refresh to update.",
      };
    }

    if (intent === "remove") {
      await removeCartItem(token, productId);
    } else {
      // Already validated above; parse again to narrow the type.
      const quantity = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(formData.get("quantity"));

      // Reductions do not depend on current stock.
      if (quantity > item.quantity) {
        const stock = await getProductStock(productId);

        if (!stock.inStock || quantity > stock.stock) {
          return {
            message:
              "That quantity is no longer available. Choose a smaller amount.",
          };
        }
      }

      await updateCartItem(token, productId, quantity);
    }
  } catch (error) {
    unstable_rethrow(error);

    console.error("[storefront/cart] Edit failed:", error);

    return {
      message:
        "We couldn’t confirm this change. Refresh the cart before retrying.",
    };
  }

  refresh();

  return { message: "Cart updated." };
}

export async function resetExpiredCartAction(
  _previousState: CartEditState,
  _formData: FormData,
): Promise<CartEditState> {
  try {
    const token = await readCartToken();

    if (token) {
      let confirmedMissing = false;

      try {
        await getCart(token);
      } catch (error) {
        unstable_rethrow(error);

        if (
          error instanceof SwagApiError &&
          error.status === 404
        ) {
          confirmedMissing = true;
        } else {
          throw error;
        }
      }

      if (!confirmedMissing) {
        refresh();
        return {
          message: "Your cart is still available. It has been refreshed.",
        };
      }
    }

    await clearCartToken();
  } catch (error) {
    unstable_rethrow(error);

    console.error("[storefront/cart] Session reset failed:", error);

    return {
      message: "Unable to reset the expired session. Please try again.",
    };
  }

  refresh();

  return { message: "Expired session cleared." };
}