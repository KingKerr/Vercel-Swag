import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  try {
    const sql = neon(connectionString);

    const rows = await sql`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        now() AS checked_at
    `;

    console.table(rows);
  } catch {
    console.error(
      "Database connection failed. Check the Neon connection, " +
        "credentials, and network access. No schema changes were attempted.",
    );

    process.exitCode = 1;
  }
}