// Write core for Ops moderation (PRD §7 Flow E, §10). Same contract as
// lib/write/experiences.ts: explicit actor, no "use server", one db.batch()
// per action so the status change, the audit row, and the author notification
// land together or not at all.
//
// Reason discipline: suggest-edits, reject, and hide all REQUIRE a reason —
// there is no silent moderation. Hide/unhide additionally append to
// moderation_actions (the permanent answer to "who did this and why").
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";

type Batchable = Parameters<typeof db.batch>[0][number];
type ExpRow = typeof s.experiences.$inferSelect;

async function loadExp(expId: string): Promise<ExpRow> {
  const [exp] = await db.select().from(s.experiences).where(eq(s.experiences.id, expId));
  if (!exp) throw new WriteError("Post not found");
  return exp;
}

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
}

// ── Hide / Unhide a LIVE post (PRD §10) ──────────────────────────────────────
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
