// Server-side auth helpers - the Clerk ↔ users-table seam (handbook §3).
// Clerk owns sessions; our `users` table stays the system of record for
// authorship/roles so swapping the auth vendor never touches the data model.
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { batchYearFromEmail, cleanPersonName } from "@/lib/user-display";
import type { Viewer } from "@/lib/viewer";

// ── Dev impersonation (handbook §7) ──────────────────────────────────────────
// The preview/headless browser can never complete a Clerk dev-instance flow
// (it requires top-level navigation to *.clerk.accounts.dev). Under `next
// dev` ONLY, a `dev-impersonate` cookie (set via /dev-login?as=<email>) short-
// circuits BOTH auth helpers to a seeded users row - Clerk is never consulted.
// Three gates keep this inert in production: NODE_ENV === "development"
// (always "production" on Vercel builds), the cookie, and the users row must
// exist. The cookie is set by a route that itself 404s outside dev.
export const DEV_IMPERSONATE_COOKIE = "dev-impersonate";

// Defense in depth - ALL must hold, and any single one keeps production safe:
//  1. DEV_AUTH_BYPASS=1 - explicit opt-in, lives only in gitignored
//     .env.local; never set on Vercel. Default OFF even for `next dev`.
//  2. NODE_ENV === "development" - always "production" on Vercel builds.
//  3. !VERCEL - Vercel sets this env var unconditionally, so even a
//     misconfigured NODE_ENV cannot wake the bypass up there.
// (Then the cookie must be present AND resolve to an existing users row.)
export function isDevBypassEnabled(): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL
  );
}

async function devImpersonationEmail(): Promise<string | null> {
  if (!isDevBypassEnabled()) return null;
  const jar = await cookies();
  return jar.get(DEV_IMPERSONATE_COOKIE)?.value ?? null;
}

// Env allowlist helper - comma-separated, case-insensitive.
function envAllowlist(raw: string | undefined, email: string | null | undefined): boolean {
  if (!email) return false;
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

// OPS_EMAILS: bootstrap allowlist for Ops ACCESS. DB roles are now the primary
// gate (managed in /ops/users); this stays as an OR-gate so a misconfigured
// roles table can never lock moderators out of the queue.
export function isOpsEmail(email?: string | null): boolean {
  return envAllowlist(process.env.OPS_EMAILS, email);
}

// SUPER_ADMIN_EMAILS: bootstrap allowlist for the SUPER-ADMIN power (granting
// roles). Solves the chicken-and-egg on a fresh DB - before anyone holds the
// super_admin role there'd be no one able to assign it. Keep this to the one
// or two people who own role management; once they're super_admin in the DB it
// is redundant but harmless. Distinct from OPS_EMAILS on purpose: a student who
// helps moderate can be in OPS_EMAILS WITHOUT gaining role-management power.
export function isSuperAdminEmail(email?: string | null): boolean {
  return envAllowlist(process.env.SUPER_ADMIN_EMAILS, email);
}

export type AuthGate =
  | { status: "signed-out" }
  | { status: "ok"; email: string; viewer: Viewer };

// Mirror the Clerk user into our `users` table (upsert by sst_email) on first
// sign-in. After the first mirror we stamp Clerk publicMetadata with the DB id
// so subsequent requests skip the DB write entirely; `isOps`/`isSuper` ride
// along so the client nav can show/hide the Ops link (the authoritative gate is
// server-side in app/ops/layout.tsx) AND so adding someone to OPS_EMAILS /
// SUPER_ADMIN_EMAILS later re-triggers the slow path. Re-syncs when either
// allowlist changes.
//
// Self-healing super-admin (Option A): an email in SUPER_ADMIN_EMAILS is
// promoted to super_admin IN THE DB here, so the users table + role_change_audit
// stay the single source of truth - the env var is just the seed that breaks the
// fresh-DB chicken-and-egg, and can be removed once the role is set.
export async function ensureDbUser(): Promise<AuthGate> {
  const devEmail = await devImpersonationEmail();
  if (devEmail) {
    const [row] = await db.select().from(s.users).where(eq(s.users.sstEmail, devEmail));
    if (row)
      return {
        status: "ok",
        email: row.sstEmail,
        viewer: { name: row.name, email: row.sstEmail, role: row.role, isOps: isOpsUser(row), imageUrl: null, dev: true },
      };
    return { status: "signed-out" }; // stale cookie (e.g. after a reseed)
  }

  const user = await currentUser();
  if (!user) return { status: "signed-out" };

  // Who may sign in is decided entirely in the Clerk dashboard (Google-only +
  // the sst.scaler.com domain allowlist / individually allowed emails). The
  // former code-level domain backstop was removed 2026-06-13: one place to
  // manage access, and adding a guest in Clerk is sufficient.
  const email = (user.primaryEmailAddress?.emailAddress ?? "").toLowerCase();
  if (!email) return { status: "signed-out" }; // Clerk user with no email - nothing to key on

  const wantsSuper = isSuperAdminEmail(email);
  const name = cleanPersonName(user.fullName) || shortFromEmail(email);

  // Resolve our row (system of record) every request - one cheap indexed
  // lookup - so viewer.isOps can reflect the DB ROLE: a moderator promoted
  // purely via /ops/users gets the Ops nav link without being in OPS_EMAILS.
  // The expensive op (the Clerk metadata write) is still skipped once dbUserId
  // is stamped. Name is written ONCE on first insert (Google names are
  // unreliable - "THRISHAL ."); existing/seeded/Ops-curated rows keep theirs.
  let [row] = await db.select().from(s.users).where(eq(s.users.sstEmail, email));
  if (!row) {
    const [inserted] = await db
      .insert(s.users)
      .values({ sstEmail: email, name, batchYear: batchYearFromEmail(email) })
      .onConflictDoNothing({ target: s.users.sstEmail })
      .returning();
    row = inserted ?? (await db.select().from(s.users).where(eq(s.users.sstEmail, email)))[0];
  }

  // Self-healing super-admin write-through (idempotent) + audit row, so the
  // env bootstrap is visible in the trail like any other promotion.
  if (wantsSuper && row.role !== "super_admin") {
    await db.batch([
      db.update(s.users).set({ role: "super_admin" }).where(eq(s.users.id, row.id)),
      db.insert(s.roleChangeAudit).values({
        changedUserId: row.id,
        changedByUserId: row.id,
        fromRole: row.role,
        toRole: "super_admin",
        reason: "bootstrapped via SUPER_ADMIN_EMAILS",
      }),
    ]);
    row = { ...row, role: "super_admin" };
  }

  const viewer: Viewer = {
    name,
    email,
    role: row.role,
    isOps: isOpsUser(row) || wantsSuper,
    // Google photo via Clerk; hasImage is false for accounts with no real
    // picture, so we keep the initials chip instead of Clerk's default avatar.
    imageUrl: user.hasImage ? user.imageUrl : null,
    dev: false,
  };

  // Stamp the DB id into Clerk metadata once for cheap identity resolution
  // elsewhere; skip the slow Clerk write when it's already correct.
  const meta = user.publicMetadata as { dbUserId?: string };
  if (meta.dbUserId !== row.id) {
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, { publicMetadata: { dbUserId: row.id } });
  }
  return { status: "ok", email, viewer };
}

// ── Action-layer authorization (write loop, Session 2) ──────────────────────
// Server Actions resolve the signed-in Clerk user to OUR users row and gate on
// the DB role. The OPS_EMAILS env allowlist stays as a bootstrap OR-gate so a
// misconfigured roles table can never lock Ops out of moderation.
export type DbUser = typeof s.users.$inferSelect;

export async function requireDbUser(): Promise<DbUser> {
  const devEmail = await devImpersonationEmail();
  if (devEmail) {
    const [row] = await db.select().from(s.users).where(eq(s.users.sstEmail, devEmail));
    if (!row)
      throw new Error(`Dev impersonation: no users row for ${devEmail} - reseed or /dev-login?off`);
    return row;
  }

  const user = await currentUser();
  const email = (user?.primaryEmailAddress?.emailAddress ?? "").toLowerCase();
  if (!user || !email) throw new Error("Not signed in");
  const [row] = await db.select().from(s.users).where(eq(s.users.sstEmail, email));
  if (!row) throw new Error("No account - reload and try again");
  return row;
}

export function isOpsUser(u: DbUser): boolean {
  return u.role === "moderator" || u.role === "super_admin" || isOpsEmail(u.sstEmail);
}

// Moderator = the role allowed to take DESTRUCTIVE moderation actions (hide /
// unhide). Deliberately role-only - it does NOT honor the OPS_EMAILS bootstrap,
// so a student who's in OPS_EMAILS to help triage the queue can't hide a live
// post by mistake (concern #4). super_admin counts as a moderator.
export function isModerator(u: DbUser): boolean {
  return u.role === "moderator" || u.role === "super_admin";
}

export async function requireModerator(): Promise<DbUser> {
  const u = await requireDbUser();
  if (!isModerator(u)) throw new Error("Moderator access required");
  return u;
}

// Super admin = the only role allowed to grant/revoke roles. The DB role is the
// source of truth (ensureDbUser writes SUPER_ADMIN_EMAILS through to it on
// sign-in); the email OR-gate stays only as a can't-lock-yourself-out fallback
// for the window before that write-through has run (or after a DB reset).
export function isSuperAdmin(u: DbUser): boolean {
  return u.role === "super_admin" || isSuperAdminEmail(u.sstEmail);
}

export async function requireOps(): Promise<DbUser> {
  const u = await requireDbUser();
  if (!isOpsUser(u)) throw new Error("Moderator access required");
  return u;
}

export async function requireSuperAdmin(): Promise<DbUser> {
  const u = await requireDbUser();
  if (!isSuperAdmin(u)) throw new Error("Super admin access required");
  return u;
}

function shortFromEmail(email: string): string {
  const first = email.split("@")[0].split(".")[0] || "Student";
  return first[0].toUpperCase() + first.slice(1);
}
