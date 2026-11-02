import { neon } from "@neondatabase/serverless";

type Rule = {
  action: string;
  shopperLimit: number;
  globalLimit: number;
  windowSeconds: number;
};

const policies = {
  bootstrap: [
    {
      action: "bootstrap_daily",
      shopperLimit: 3,
      globalLimit: 12,
      windowSeconds: 86_400,
    },
  ],

  message: [
    {
      action: "message_burst",
      shopperLimit: 6,
      globalLimit: 20,
      windowSeconds: 60,
    },
    {
      action: "message_daily",
      shopperLimit: 40,
      globalLimit: 120,
      windowSeconds: 86_400,
    },
  ],

  proposal: [
    {
      action: "proposal_hourly",
      shopperLimit: 12,
      globalLimit: 60,
      windowSeconds: 3_600,
    },
  ],

  commit: [
    {
      action: "commit_hourly",
      shopperLimit: 6,
      globalLimit: 30,
      windowSeconds: 3_600,
    },
  ],
} satisfies Record<string, readonly Rule[]>;

export type ConciergeUsageKind = keyof typeof policies;

export async function reserveConciergeUsage(
  kind: ConciergeUsageKind,
  shopperId: string,
): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(connectionString);

  for (const rule of policies[kind]) {
    const rows = await sql`
      SELECT concierge.reserve_usage(
        ${rule.action},
        ${shopperId}::uuid,
        ${rule.shopperLimit}::integer,
        ${rule.globalLimit}::integer,
        ${rule.windowSeconds}::integer
      ) AS allowed
    `;

    if (rows[0]?.allowed !== true) {
      return false;
    }
  }

  return true;
}