// One-off DEV utility: drop + recreate the `public` schema so the migration
// baseline (drizzle/0000_baseline.sql) can be applied from scratch and proven
// faithful. HARD-GUARDED against the production endpoint — dev/backup branches
// only. Run: npx tsx --env-file=.env.local db/reset-schema.ts
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL not set");
  // The production compute endpoint — never reset against it.
  if (url.includes("ep-delicate-frost-ao4tdzc7")) {
    throw new Error("REFUSING: DATABASE_URL points at the PROD endpoint");
  }
  const sql = neon(url);
  await sql`drop schema if exists public cascade`;
  await sql`create schema public`;
  console.log("✓ public schema reset on", new URL(url).hostname);
}

main().catch((e) => {
  console.error("reset failed:", e?.message ?? e);
  process.exit(1);
});
