import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  ForbiddenError,
  type AuthFn,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { z } from "zod";

import { reserveConciergeUsage } from "../../shared/concierge-usage";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-swag-concierge"
    : "swag-concierge";

function database() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(connectionString);
}

function bootstrapCredentialMatches(request: Request) {
  const secret = process.env.CONCIERGE_BOOTSTRAP_SECRET;

  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "CONCIERGE_BOOTSTRAP_SECRET must be 64 hex characters.",
    );
  }

  const received = Buffer.from(
    request.headers.get("authorization") ?? "",
  );

  const expected = Buffer.from(`Bearer ${secret}`);

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

function shopperCookie(request: Request) {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`));

  // Reject ambiguous duplicate cookies.
  if (matches.length !== 1) {
    return null;
  }

  const value = matches[0].slice(cookieName.length + 1);

  return /^[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : null;
}

function allowedOrigins() {
  const origins = new Set(
    (process.env.CONCIERGE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  return origins;
}

function checkBrowserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const origins = allowedOrigins();

  if (origin && !origins.has(origin)) {
    console.warn("[concierge/auth-denied]", {
      reason: "origin-not-allowed",
      method: request.method,
      origin,
      allowedOrigins: [...origins],
    });

    throw new ForbiddenError();
  }

  // Browser mutation requests must include an approved Origin.
  if (request.method === "POST" && !origin) {
    console.warn("[concierge/auth-denied]", {
      reason: "missing-origin",
      method: request.method,
    });

    throw new ForbiddenError();
  }
}

const shopperAuth: AuthFn<Request> = async (request) => {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.CONCIERGE_DEMO_ENABLED !== "true"
  ) {
    console.warn("[concierge/auth-denied]", {
      reason: "concierge-disabled",
    });

    return null;
  }

  const pathname = new URL(request.url).pathname;

  // Only the trusted Next.js bootstrap may create conversations.
  if (
    pathname === "/eve/v1/session" ||
    pathname === "/eve/v1/session/"
  ) {
    if (request.method !== "POST") {
      console.warn("[concierge/auth-denied]", {
        reason: "bootstrap-method-not-allowed",
        method: request.method,
      });

      return null;
    }

    if (!bootstrapCredentialMatches(request)) {
      console.warn("[concierge/auth-denied]", {
        reason: "bootstrap-credential-invalid",
      });

      return null;
    }

    const shopperId = z.string().uuid().safeParse(
      request.headers.get("x-concierge-shopper-id"),
    );

    if (!shopperId.success) {
      console.warn("[concierge/auth-denied]", {
        reason: "bootstrap-shopper-id-invalid",
      });

      return null;
    }

    const sql = database();

    const rows = await sql`
      SELECT id
      FROM concierge.sessions
      WHERE id = ${shopperId.data}
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `;

    if (!rows[0]) {
      console.warn("[concierge/auth-denied]", {
        reason: "bootstrap-shopper-session-not-active",
      });

      return null;
    }

    return {
      authenticator: "concierge-shopper",
      principalId: shopperId.data,
      principalType: "user",
      attributes: {
        source: "server-bootstrap",
      },
    };
  }

  // Allow only the session routes used by this bounded UI.
  const match = pathname.match(
    /^\/eve\/v1\/session\/([^/]+)(?:\/(?:stream|cancel|clear|compact|end|prewarm))?\/?$/,
  );

  if (
    !match ||
    !["GET", "POST"].includes(request.method)
  ) {
    console.warn("[concierge/auth-denied]", {
      reason: "route-or-method-not-allowed",
      method: request.method,
    });

    return null;
  }

  checkBrowserOrigin(request);

  const secret = shopperCookie(request);

  if (!secret) {
    console.warn("[concierge/auth-denied]", {
      reason: "shopper-cookie-missing-or-invalid",
    });

    return null;
  }

  let eveSessionId: string;

  try {
    eveSessionId = decodeURIComponent(match[1]);
  } catch {
    console.warn("[concierge/auth-denied]", {
      reason: "session-id-decode-failed",
    });

    return null;
  }

  if (
    eveSessionId.length === 0 ||
    eveSessionId.length > 512
  ) {
    console.warn("[concierge/auth-denied]", {
      reason: "session-id-invalid-length",
    });

    return null;
  }

  const tokenHash = createHash("sha256")
    .update(secret)
    .digest("hex");

  const sql = database();

  const shoppers = await sql`
    SELECT id
    FROM concierge.sessions
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;

  if (!shoppers[0]) {
    console.warn("[concierge/auth-denied]", {
      reason: "shopper-session-not-active",
    });

    return null;
  }

  const shopperId = z.string().uuid().parse(shoppers[0].id);

  const owned = await sql`
    SELECT eve_session_id
    FROM concierge.eve_sessions
    WHERE eve_session_id = ${eveSessionId}
      AND shopper_session_id = ${shopperId}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;

  if (!owned[0]) {
    console.warn("[concierge/auth-denied]", {
      reason: "conversation-not-owned-or-not-active",
    });

    throw new ForbiddenError();
  }

  const submitsTurn =
    request.method === "POST" &&
    /^\/eve\/v1\/session\/[^/]+\/?$/.test(pathname);

  if (submitsTurn) {
    const allowed = await reserveConciergeUsage(
      "message",
      shopperId,
    );

    if (!allowed) {
      console.warn("[concierge/auth-denied]", {
        reason: "message-usage-limit",
      });

      throw new ForbiddenError({
        code: "demo_usage_limit",
        message:
          "This demo's message allowance has been reached. " +
          "Please wait or contact the demo owner.",
      });
    }
  }

  return {
    authenticator: "concierge-shopper",
    principalId: shopperId,
    principalType: "user",
    attributes: {
      source: "shopper-cookie",
    },
  };
};

export default eveChannel({
  auth: [shopperAuth],
});