import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local itself; drizzle-kit runs outside Next, so load it
// here (Node 20.12+ built-in — no dotenv dependency).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI/Vercel provide DATABASE_URL directly
  }
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
