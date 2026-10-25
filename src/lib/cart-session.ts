import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

const CART_COOKIE = "swag-cart-token";

export async function readCartToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(CART_COOKIE)?.value;

  const result = z.string().uuid().safeParse(value);

  return result.success ? result.data : null;
}

export async function saveCartToken(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearCartToken() {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE);
}