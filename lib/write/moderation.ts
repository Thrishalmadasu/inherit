// Write core for Ops moderation (PRD §7 Flow E, §10). Same contract as
// lib/write/experiences.ts: explicit actor, no "use server", one db.batch()
// per action so the status change, the audit row, and the author notification
// land together or not at all.
//
// Reason discipline: suggest-edits, reject, and hide all REQUIRE a reason —
// there is no silent moderation. Hide/unhide additionally append to
// moderation_actions (the permanent answer to "who did this and why").
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import { dispatchStatus } from "@/lib/email";
import { statusEmailContent, type StatusKind } from "@/lib/email/templates";
import { WriteError } from "@/lib/write/experiences";

const slugify = (x: string) =>
  x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Batchable = Parameters<typeof db.batch>[0][number];
type ExpRow = typeof s.experiences.$inferSelect & {
  authorEmail: string;
  authorName: string;
  companyName: string;
};

async function loadExp(expId: string): Promise<ExpRow> {
  // Author + company ride along: every transition emails the author about
  // their "<company> post" (Flow D), so the facts come from one read. The
  // company join is LEFT — a post with a not-yet-resolved proposed company has
  // companyId NULL but must still load (the moderator resolves it here).
  const [row] = await db
    .select({
      exp: s.experiences,
      authorEmail: s.users.sstEmail,
      authorName: s.users.name,
      companyName: s.companies.name,
    })
    .from(s.experiences)
    .innerJoin(s.users, eq(s.users.id, s.experiences.authorId))
    .leftJoin(s.companies, eq(s.companies.id, s.experiences.companyId))
    .where(eq(s.experiences.id, expId));
  if (!row) throw new WriteError("Post not found");
  return {
    ...row.exp,
    authorEmail: row.authorEmail,
    authorName: row.authorName,
    companyName: row.companyName ?? row.exp.proposedCompanyName ?? "—",
  };
}

// Review-status email (PRD §7 Flow D) — AFTER the batch commits, best-effort:
// the notifications row is the durable record, the email is the nudge.
const emailAuthor = (exp: ExpRow, kind: StatusKind, note?: string) =>
  dispatchStatus({
    to: exp.authorEmail,
    ...statusEmailContent(kind, {
      authorName: exp.authorName,
      company: exp.companyName,
      role: exp.roleTitle,
      expId: exp.id,
      note,
    }),
  });

// Reviewable = actually sitting in the queue. Guards against double-clicks
// and acting on a post the author just withdrew or deleted.
function assertPending(exp: ExpRow) {
  if (exp.reviewStatus !== "under_review" || exp.withdrawnAt || exp.deletedAt)
    throw new WriteError("This post is no longer in the review queue");
}

const notify = (
  exp: ExpRow,
  type: (typeof s.notificationType.enumValues)[number],
  payload?: Record<string, string>,
) =>
  db.insert(s.notifications).values({
    userId: exp.authorId,
    type,
    experienceId: exp.id,
    payload: payload ?? null,
  });

const review = (actor: DbUser) => ({ reviewedBy: actor.id, reviewedAt: new Date() });

export async function approveCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadExp(expId);
  assertPending(exp);
  // Single-gate canonicality (concern #10): a post can't go live naming a
  // company that isn't in the canonical list. The moderator must resolve the
  // proposed name first (map to an existing company or promote it).
  if (!exp.companyId)
    throw new WriteError(
      `Resolve the proposed company “${exp.proposedCompanyName ?? ""}” before approving`,
    );
  await db.batch([
    db
      .update(s.experiences)
      .set({
        reviewStatus: "approved",
        ...review(actor),
        reviewNotes: null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(s.experiences.id, expId)),
    notify(exp, "post_live"),
  ]);
  await emailAuthor(exp, "live");
}

export async function suggestEditsCore(actor: DbUser, expId: string, note: string): Promise<void> {
  if (!note.trim()) throw new WriteError("A reviewer note is required");
  const exp = await loadExp(expId);
  assertPending(exp);
  await db.batch([
    db
      .update(s.experiences)
      .set({
        reviewStatus: "needs_edits",
        ...review(actor),
        reviewNotes: note.trim(),
        updatedAt: new Date(),
      })
      .where(eq(s.experiences.id, expId)),
    notify(exp, "post_needs_edits", { note: note.trim() }),
  ]);
  await emailAuthor(exp, "needs_edits", note.trim());
}

export async function rejectCore(actor: DbUser, expId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new WriteError("A rejection reason is required");
  const exp = await loadExp(expId);
  assertPending(exp);
  await db.batch([
    db
      .update(s.experiences)
      .set({
        reviewStatus: "rejected",
        ...review(actor),
        reviewNotes: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(s.experiences.id, expId)),
    notify(exp, "post_rejected", { reason: reason.trim() }),
  ]);
  await emailAuthor(exp, "rejected", reason.trim());
}

// ── Hide / Unhide a LIVE post (PRD §10) ──────────────────────────────────────
// No email on hide/unhide — PRD §12 scopes review-status emails to the four
// review transitions; the in-app notification row still records it.
export async function hideCore(actor: DbUser, expId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new WriteError("A hide reason is required — no silent hides");
  const exp = await loadExp(expId);
  if (exp.reviewStatus !== "approved" || exp.deletedAt)
    throw new WriteError("Only live, approved posts can be hidden");
  if (exp.hiddenAt) throw new WriteError("Already hidden");
  await db.batch([
    db
      .update(s.experiences)
      .set({
        hiddenAt: new Date(),
        hiddenBy: actor.id,
        hiddenReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(s.experiences.id, expId)),
    db.insert(s.moderationActions).values({
      experienceId: expId,
      actorId: actor.id,
      action: "hide",
      reason: reason.trim(),
    }),
    notify(exp, "post_hidden", { reason: reason.trim() }),
  ]);
}

export async function unhideCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadExp(expId);
  if (!exp.hiddenAt) throw new WriteError("This post isn't hidden");
  await db.batch([
    db
      .update(s.experiences)
      .set({ hiddenAt: null, hiddenBy: null, hiddenReason: null, updatedAt: new Date() })
      .where(eq(s.experiences.id, expId)),
    db.insert(s.moderationActions).values({
      experienceId: expId,
      actorId: actor.id,
      action: "unhide",
      reason: null,
    }),
    // back live immediately (it was already approved) — tell the author
    notify(exp, "post_live"),
  ]);
}

// ── Resolve a proposed company during review (concern #10) ───────────────────
// The student named a company that wasn't canonical; it rode along as a
// proposed name. The moderator now either MAPS it to an existing canonical
// company (dedup — and the proposed spelling is folded in as an alias so the
// next student who types it auto-binds) or PROMOTES it to a brand-new canonical
// company. Either way companyId gets set and proposedCompanyName is cleared, so
// approval can proceed. This is the single gate — companies are never created
// speculatively. Idempotent-ish: only acts while the post is still proposed.
export type CompanyResolution =
  | { existingCompanyId: string }
  | { newCompany: { name: string; industry?: string; location?: string } };

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "company";
  let slug = root;
  for (let i = 2; ; i++) {
    const [clash] = await db
      .select({ id: s.companies.id })
      .from(s.companies)
      .where(eq(s.companies.slug, slug));
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
}

export async function resolveExperienceCompanyCore(
  actor: DbUser,
  expId: string,
  resolution: CompanyResolution,
): Promise<{ companyName: string }> {
  const exp = await loadExp(expId);
  if (exp.companyId) throw new WriteError("This post's company is already resolved");
  const proposed = exp.proposedCompanyName?.trim() ?? "";

  if ("existingCompanyId" in resolution) {
    const [target] = await db
      .select()
      .from(s.companies)
      .where(eq(s.companies.id, resolution.existingCompanyId));
    if (!target) throw new WriteError("Company not found");
    // Fold the proposed spelling in as an alias so future submissions auto-bind
    // (dedup at the root — no second row ever appears for this variant).
    const variant = proposed.toLowerCase();
    const known = new Set([target.name.toLowerCase(), ...target.aliases.map((a) => a.toLowerCase())]);
    const stmts: Batchable[] = [
      db.update(s.experiences).set({ companyId: target.id, proposedCompanyName: null }).where(eq(s.experiences.id, expId)),
    ];
    if (variant && !known.has(variant))
      stmts.push(
        db
          .update(s.companies)
          .set({ aliases: sql`array_append(${s.companies.aliases}, ${proposed})` })
          .where(eq(s.companies.id, target.id)),
      );
    await db.batch(stmts as [Batchable, ...Batchable[]]);
    return { companyName: target.name };
  }

  const name = resolution.newCompany.name.trim() || proposed;
  if (!name) throw new WriteError("A company name is required");
  // Guard against creating a duplicate: if a canonical company already matches
  // by name or alias, bind to it instead of inserting a second row.
  const [existing] = await db
    .select({ id: s.companies.id, name: s.companies.name })
    .from(s.companies)
    .where(
      sql`lower(${s.companies.name}) = ${name.toLowerCase()}
          or exists (select 1 from unnest(${s.companies.aliases}) a where lower(a) = ${name.toLowerCase()})`,
    );
  if (existing) {
    await db
      .update(s.experiences)
      .set({ companyId: existing.id, proposedCompanyName: null })
      .where(eq(s.experiences.id, expId));
    return { companyName: existing.name };
  }

  const slug = await uniqueSlug(name);
  const [created] = await db
    .insert(s.companies)
    .values({
      name,
      slug,
      industry: resolution.newCompany.industry?.trim() || null,
      location: resolution.newCompany.location?.trim() || null,
    })
    .returning({ id: s.companies.id, name: s.companies.name });
  await db
    .update(s.experiences)
    .set({ companyId: created.id, proposedCompanyName: null })
    .where(eq(s.experiences.id, expId));
  return { companyName: created.name };
}

// Pending count for the Ops nav badge.
export async function countPending(): Promise<number> {
  const rows = await db
    .select({ id: s.experiences.id })
    .from(s.experiences)
    .where(
      and(
        eq(s.experiences.reviewStatus, "under_review"),
        isNull(s.experiences.withdrawnAt),
        isNull(s.experiences.deletedAt),
      ),
    );
  return rows.length;
}
