// Server-side auth helpers — the Clerk ↔ users-table seam (handbook §3).
// Clerk owns sessions; our `users` table stays the system of record for
// authorship/roles so swapping the auth vendor never touches the data model.
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { batchYearFromEmail, cleanPersonName } from "@/lib/user-display";

export const SST_DOMAIN = "sst.scaler.com";

// OPS_EMAILS: comma-separated allowlist (env). Interim gate until DB roles
// land with the write loop (Session 2).
export function isOpsEmail(email?: string | null): boolean {
  if (!email) return false;
  return (process.env.OPS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export type AuthGate =
  | { status: "signed-out" }
  | { status: "wrong-domain"; email: string }
  | { status: "ok"; email: string };

// Mirror the Clerk user into our `users` table (upsert by sst_email) on first
// sign-in. After the first mirror we stamp Clerk publicMetadata with the DB id
// so subsequent requests skip the DB write entirely; `isOps` rides along so
// the client nav can show/hide the Ops link (the authoritative gate is
// server-side in app/ops/layout.tsx). Re-syncs if OPS_EMAILS changes.
export async function ensureDbUser(): Promise<AuthGate> {
  const user = await currentUser();
  if (!user) return { status: "signed-out" };

  const email = (user.primaryEmailAddress?.emailAddress ?? "").toLowerCase();
  // Backstop to the Clerk dashboard domain allowlist — never trust one layer.
  if (!email.endsWith(`@${SST_DOMAIN}`)) return { status: "wrong-domain", email };

  const meta = user.publicMetadata as { dbUserId?: string; isOps?: boolean };
  const isOps = isOpsEmail(email);
  if (meta.dbUserId && meta.isOps === isOps) return { status: "ok", email };

  // Name is written on first insert only — our `users` table is the system of
  // record, and Google profile names are unreliable ("THRISHAL ."). Existing
  // rows (seeded or Ops-curated) keep their name.
  const name = cleanPersonName(user.fullName) || shortFromEmail(email);
  const [inserted] = await db
    .insert(s.users)
    .values({ sstEmail: email, name, batchYear: batchYearFromEmail(email) })
    .onConflictDoNothing({ target: s.users.sstEmail })
    .returning({ id: s.users.id });
  const row =
    inserted ??
    (await db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.sstEmail, email)))[0];

  const client = await clerkClient();
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: { dbUserId: row.id, isOps },
  });
  return { status: "ok", email };
}

// ── Action-layer authorization (write loop, Session 2) ──────────────────────
// Server Actions resolve the signed-in Clerk user to OUR users row and gate on
// the DB role. The OPS_EMAILS env allowlist stays as a bootstrap OR-gate so a
// misconfigured roles table can never lock Ops out of moderation.
export type DbUser = typeof s.users.$inferSelect;

export async function requireDbUser(): Promise<DbUser> {
  const user = await currentUser();
  const email = (user?.primaryEmailAddress?.emailAddress ?? "").toLowerCase();
  if (!user || !email.endsWith(`@${SST_DOMAIN}`)) throw new Error("Not signed in");
  const [row] = await db.select().from(s.users).where(eq(s.users.sstEmail, email));
  if (!row) throw new Error("No account — reload and try again");
  return row;
}

export function isOpsUser(u: DbUser): boolean {
  return u.role === "moderator" || u.role === "super_admin" || isOpsEmail(u.sstEmail);
}

export async function requireOps(): Promise<DbUser> {
  const u = await requireDbUser();
  if (!isOpsUser(u)) throw new Error("Moderator access required");
  return u;
}

function shortFromEmail(email: string): string {
  const first = email.split("@")[0].split(".")[0] || "Student";
  return first[0].toUpperCase() + first.slice(1);
}
