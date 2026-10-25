import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("next/cache", () => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/cart-api", () => ({
  addCartItem: vi.fn(),
  createCart: vi.fn(),
  getCart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

vi.mock("@/lib/cart-session", () => ({
  readCartToken: vi.fn(),
  saveCartToken: vi.fn(),
  clearCartToken: vi.fn(),
}));

vi.mock("@/lib/swag-api", () => ({
  getProductStock: vi.fn(),

  SwagApiError: class SwagApiError extends Error {
    constructor(public readonly status: number) {
      super(`Swag Store API returned HTTP ${status}.`);
      this.name = "SwagApiError";
    }
  },
}));

import { refresh } from "next/cache";

import {
  addToCartAction,
  editCartAction,
  resetExpiredCartAction,
} from "@/app/actions/cart";

import {
  addCartItem,
  createCart,
  getCart,
  removeCartItem,
  updateCartItem,
  type CartSummary,
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

const token = "11111111-1111-4111-8111-111111111111";
const productId = "tshirt_001";

const initialAddState = {
  status: "idle" as const,
  message: "",
};

const initialEditState = {
  message: "",
};

function form(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

function cart(quantity = 0): CartSummary {
  return {
    items:
      quantity === 0
        ? []
        : [
            {
              productId,
              quantity,
              lineTotal: quantity * 3000,
              product: {
                id: productId,
                name: "Black Crewneck T-Shirt",
                slug: "black-crewneck-t-shirt",
                price: 3000,
                currency: "USD",
                images: ["https://example.com/tshirt.png"],
              },
            },
          ],

    totalItems: quantity,
    subtotal: quantity * 3000,
    currency: "USD",
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.mocked(readCartToken).mockResolvedValue(null);
  vi.mocked(createCart).mockResolvedValue(token);
  vi.mocked(saveCartToken).mockResolvedValue(undefined);
  vi.mocked(clearCartToken).mockResolvedValue(undefined);

  vi.mocked(getCart).mockResolvedValue(cart());
  vi.mocked(addCartItem).mockResolvedValue(cart(1));
  vi.mocked(updateCartItem).mockResolvedValue(cart(1));
  vi.mocked(removeCartItem).mockResolvedValue(cart());

  vi.mocked(getProductStock).mockResolvedValue({
    productId,
    stock: 10,
    inStock: true,
    lowStock: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addToCartAction", () => {
  it("rejects an invalid quantity without calling the API", async () => {
    const result = await addToCartAction(
      initialAddState,
      form({
        productId,
        quantity: "0",
      }),
    );

    expect(result.status).toBe("error");

    expect(readCartToken).not.toHaveBeenCalled();
    expect(createCart).not.toHaveBeenCalled();
    expect(addCartItem).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("creates a cart lazily and saves its token before adding", async () => {
    const result = await addToCartAction(
      initialAddState,
      form({
        productId,
        quantity: "2",
      }),
    );

    expect(result.status).toBe("success");

    expect(createCart).toHaveBeenCalledTimes(1);
    expect(saveCartToken).toHaveBeenCalledWith(token);
    expect(addCartItem).toHaveBeenCalledWith(
      token,
      productId,
      2,
    );

    expect(
      vi.mocked(saveCartToken).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(addCartItem).mock.invocationCallOrder[0],
    );

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("checks existing cart quantity plus the requested addition", async () => {
    vi.mocked(readCartToken).mockResolvedValue(token);
    vi.mocked(getCart).mockResolvedValue(cart(4));

    vi.mocked(getProductStock).mockResolvedValue({
      productId,
      stock: 5,
      inStock: true,
      lowStock: true,
    });

    const result = await addToCartAction(
      initialAddState,
      form({
        productId,
        quantity: "2",
      }),
    );

    expect(result.status).toBe("error");

    expect(addCartItem).not.toHaveBeenCalled();
    expect(createCart).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not retry an ambiguous add failure", async () => {
    vi.mocked(readCartToken).mockResolvedValue(token);

    vi.mocked(addCartItem).mockRejectedValue(
      new Error("Connection lost after submission"),
    );

    const result = await addToCartAction(
      initialAddState,
      form({
        productId,
        quantity: "1",
      }),
    );

    expect(result.status).toBe("error");
    expect(addCartItem).toHaveBeenCalledTimes(1);
    expect(clearCartToken).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not silently replace an expired cart during an add", async () => {
    vi.mocked(readCartToken).mockResolvedValue(token);

    vi.mocked(getCart).mockRejectedValue(
      new SwagApiError(404),
    );

    const result = await addToCartAction(
      initialAddState,
      form({
        productId,
        quantity: "1",
      }),
    );

    expect(result.status).toBe("error");

    expect(createCart).not.toHaveBeenCalled();
    expect(addCartItem).not.toHaveBeenCalled();
    expect(clearCartToken).not.toHaveBeenCalled();
  });
});

describe("editCartAction", () => {
  beforeEach(() => {
    vi.mocked(readCartToken).mockResolvedValue(token);
    vi.mocked(getCart).mockResolvedValue(cart(4));
  });

  it("removes an item even if the quantity field is empty", async () => {
    const result = await editCartAction(
      initialEditState,
      form({
        productId,
        intent: "remove",
        quantity: "",
      }),
    );

    expect(result.message).toBe("Cart updated.");

    expect(removeCartItem).toHaveBeenCalledWith(
      token,
      productId,
    );

    expect(getProductStock).not.toHaveBeenCalled();
    expect(updateCartItem).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("allows quantity reductions without checking stock", async () => {
    const result = await editCartAction(
      initialEditState,
      form({
        productId,
        intent: "update",
        quantity: "2",
      }),
    );

    expect(result.message).toBe("Cart updated.");

    expect(updateCartItem).toHaveBeenCalledWith(
      token,
      productId,
      2,
    );

    expect(getProductStock).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rejects an increase above current stock", async () => {
    vi.mocked(getProductStock).mockResolvedValue({
      productId,
      stock: 5,
      inStock: true,
      lowStock: true,
    });

    await editCartAction(
      initialEditState,
      form({
        productId,
        intent: "update",
        quantity: "6",
      }),
    );

    expect(getProductStock).toHaveBeenCalledWith(productId);
    expect(updateCartItem).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("resetExpiredCartAction", () => {
  beforeEach(() => {
    vi.mocked(readCartToken).mockResolvedValue(token);
  });

  it("clears the session after a confirmed missing-cart response", async () => {
    vi.mocked(getCart).mockRejectedValue(
      new SwagApiError(404),
    );

    await resetExpiredCartAction(
      initialEditState,
      new FormData(),
    );

    expect(clearCartToken).toHaveBeenCalledTimes(1);
    expect(createCart).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("preserves an active cart instead of clearing it", async () => {
    vi.mocked(getCart).mockResolvedValue(cart(2));

    await resetExpiredCartAction(
      initialEditState,
      new FormData(),
    );

    expect(clearCartToken).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("preserves the session when the API is unavailable", async () => {
    vi.mocked(getCart).mockRejectedValue(
      new SwagApiError(503),
    );

    const result = await resetExpiredCartAction(
      initialEditState,
      new FormData(),
    );

    expect(result.message).toContain("Unable to reset");
    expect(clearCartToken).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});