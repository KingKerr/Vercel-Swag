"use server";

import { Client } from "eve/client";
import { unstable_rethrow } from "next/navigation";

import { getConciergeDb } from "@/lib/concierge-db";
import { ensureShopperSession } from "@/lib/concierge-session";
import { reserveConciergeUsage } from "../../../shared/concierge-usage";
import { conciergeEnabled } from "@/lib/concierge-access";

export type StartConciergeState = {
  status: "idle" | "ready" | "error";
  message: string;
  sessionId?: string;
};

function agentOrigin() {
  const configured = process.env.CONCIERGE_AGENT_ORIGIN;

  const value =
    configured ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : null);

  if (!value) {
    throw new Error("The agent origin is not configured.");
  }

  const url = new URL(value);

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("The agent origin must be an origin only.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error("The deployed agent origin must use HTTPS.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported agent origin.");
  }

  return url.origin;
}

export async function startConciergeAction(
  _previousState: StartConciergeState,
  _formData: FormData,
): Promise<StartConciergeState> {
  // Keep disabled in deployed builds until access/usage controls
  // and the isolation tests are complete.
  if (!conciergeEnabled()) {
    return {
      status: "error",
      message: "The deployed concierge is not enabled yet.",
    };
  }

  try {
    const shopper = await ensureShopperSession();
    const sql = getConciergeDb();

    // Reuse the shopper's latest accessible conversation.
    const existing = await sql`
      SELECT e.eve_session_id
      FROM concierge.eve_sessions AS e
      JOIN concierge.sessions AS s
        ON s.id = e.shopper_session_id
      WHERE e.shopper_session_id = ${shopper.id}
        AND e.revoked_at IS NULL
        AND e.expires_at > now()
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      ORDER BY e.created_at DESC
      LIMIT 1
    `;

    if (existing[0]) {
      return {
        status: "ready",
        message: "",
        sessionId: String(existing[0].eve_session_id),
      };
    }

    const secret = process.env.CONCIERGE_BOOTSTRAP_SECRET;

    if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
      throw new Error("The bootstrap credential is missing.");
    }

    const headers: Record<string, string> = {
      "x-concierge-shopper-id": shopper.id,
    };

    const protectionBypass =
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    if (protectionBypass) {
      headers["x-vercel-protection-bypass"] = protectionBypass;
    } 

    const allowed = await reserveConciergeUsage(
        "bootstrap", 
        "shopper.id",
    ); 

    if (!allowed) {
        return {
            status: "error", 
            message:
              "This demo's new-conversation allowance has been reached.",
        };
    }

    const client = new Client({
      baseUrl: agentOrigin(),
      auth: {
        bearer: secret,
      },
      headers,
    });

    const { session } = await client.sessions.create({
      signal: AbortSignal.timeout(20_000),
    });

    // Register ownership before revealing the session ID.
    const registered = await sql`
      INSERT INTO concierge.eve_sessions (
        eve_session_id,
        shopper_session_id,
        expires_at
      )
      SELECT
        ${session.id},
        s.id,
        LEAST(
          s.expires_at,
          now() + interval '24 hours'
        )
      FROM concierge.sessions AS s
      WHERE s.id = ${shopper.id}
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      RETURNING eve_session_id
    `;

    if (!registered[0]) {
      throw new Error("The shopper session expired.");
    }

    return {
      status: "ready",
      message: "",
      sessionId: String(registered[0].eve_session_id),
    };
  } catch (error) {
    unstable_rethrow(error);

    return {
      status: "error",
      message:
        "Unable to start the concierge. Check the agent origin, " +
        "bootstrap configuration, and database connection.",
    };
  }
}