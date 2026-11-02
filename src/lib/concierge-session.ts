import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { getConciergeDb } from "@/lib/concierge-db";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-swag-concierge"
    : "swag-concierge";

const SESSION_SECONDS = 60 * 60 * 24;

const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const idSchema = z.string().uuid();

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function readShopperSession() {
  const cookieStore = await cookies();

  const parsed = secretSchema.safeParse(
    cookieStore.get(COOKIE_NAME)?.value,
  );

  if (!parsed.success) {
    return null;
  }

  const sql = getConciergeDb();
  const tokenHash = hashSecret(parsed.data);

  const rows = await sql`
    SELECT id
    FROM concierge.sessions
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    id: idSchema.parse(rows[0].id),
  };
}

// Call only from a Server Action or Route Handler.
export async function ensureShopperSession() {
  const existing = await readShopperSession();

  if (existing) {
    return existing;
  }

  const secret = randomBytes(32).toString("base64url");
  const tokenHash = hashSecret(secret);
  const sql = getConciergeDb();

  const rows = await sql`
    INSERT INTO concierge.sessions (
      token_hash,
      expires_at
    )
    VALUES (
      ${tokenHash},
      now() + interval '24 hours'
    )
    RETURNING id
  `;

  const session = {
    id: idSchema.parse(rows[0]?.id),
  };

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });

  return session;
}