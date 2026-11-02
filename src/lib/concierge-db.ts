import "server-only";

import { neon } from "@neondatabase/serverless";

export function getConciergeDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for the concierge database.",
    );
  }

  return neon(connectionString);
}