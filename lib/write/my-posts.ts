// Write core for author self-service on My Posts / Under Review (PRD §10):
// soft-delete (restorable forever), withdraw while pending, resubmit a
// withdrawal. Author-only; delete is deliberately a different mechanism from
// Ops hide (separate columns, separate accountability).
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";

async function loadOwn(actor: DbUser, expId: string) {
  const [exp] = await db.select().from(s.experiences).where(eq(s.experiences.id, expId));
  if (!exp || exp.authorId !== actor.id) throw new WriteError("Post not found");
  return exp;
}

export async function deleteMyPostCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadOwn(actor, expId);
  if (exp.deletedAt) throw new WriteError("Already deleted");
  await db
    .update(s.experiences)
    .set({ deletedAt: new Date(), deletedBy: actor.id, updatedAt: new Date() })
    .where(eq(s.experiences.id, expId));
}

export async function restoreMyPostCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadOwn(actor, expId);
  if (!exp.deletedAt) throw new WriteError("This post isn't deleted");
  await db
    .update(s.experiences)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(eq(s.experiences.id, expId));
}

// Withdraw: pull a pending post out of the queue without losing it.
export async function withdrawMyPostCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadOwn(actor, expId);
  if (exp.reviewStatus !== "under_review" || exp.withdrawnAt || exp.deletedAt)
    throw new WriteError("Only posts under review can be withdrawn");
  await db
    .update(s.experiences)
    .set({ withdrawnAt: new Date(), updatedAt: new Date() })
    .where(eq(s.experiences.id, expId));
}

// Resubmit a withdrawn post unchanged — re-stamps created_at, so it joins the
// back of the FIFO queue like any other (re)submission.
export async function resubmitWithdrawnCore(actor: DbUser, expId: string): Promise<void> {
  const exp = await loadOwn(actor, expId);
  if (!exp.withdrawnAt || exp.deletedAt) throw new WriteError("This post isn't withdrawn");
  const now = new Date();
  await db.batch([
    db
      .update(s.experiences)
      .set({ withdrawnAt: null, createdAt: now, updatedAt: now })
      .where(eq(s.experiences.id, expId)),
    db.insert(s.notifications).values({
      userId: actor.id,
      type: "post_under_review",
      experienceId: expId,
    }),
  ]);
}
