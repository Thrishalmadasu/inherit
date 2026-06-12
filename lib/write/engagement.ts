// Write core for the engagement layer (roadmap #3): Helpful votes, saves,
// unique view counts. Same shape as the other cores — explicit `actor`, no
// "use server", reachable only via app/actions/* and the verify script.
//
// The cached counters (helpful_count / view_count) move in the SAME SQL
// statement that inserts/deletes the row, with the increment derived from how
// many rows the CTE actually touched. One statement = one transaction on the
// Neon HTTP driver, and `on conflict do nothing` against the UNIQUE
// constraint/PK makes concurrent or repeated calls idempotent: the counter
// can never drift from the rows.
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";

// Engagement only applies to live posts — same condition as `visibleExp`.
async function requireVisible(expId: string): Promise<void> {
  const [row] = await db
    .select({
      reviewStatus: s.experiences.reviewStatus,
      deletedAt: s.experiences.deletedAt,
      hiddenAt: s.experiences.hiddenAt,
    })
    .from(s.experiences)
    .where(sql`${s.experiences.id} = ${expId}`);
  if (!row || row.reviewStatus !== "approved" || row.deletedAt || row.hiddenAt)
    throw new WriteError("Post not found");
}

// Helpful is a TARGET-state setter, not a blind toggle: the client sends where
// it wants to land, so an out-of-sync client converges instead of flipping.
export async function setHelpfulCore(actor: DbUser, expId: string, on: boolean): Promise<void> {
  await requireVisible(expId);
  if (on) {
    await db.execute(sql`
      with ins as (
        insert into reactions (user_id, experience_id)
        values (${actor.id}, ${expId})
        on conflict do nothing
        returning 1
      )
      update experiences
         set helpful_count = helpful_count + (select count(*) from ins)
       where id = ${expId}
    `);
  } else {
    await db.execute(sql`
      with del as (
        delete from reactions
         where user_id = ${actor.id} and experience_id = ${expId}
        returning 1
      )
      update experiences
         set helpful_count = greatest(helpful_count - (select count(*) from del), 0)
       where id = ${expId}
    `);
  }
}

export async function setSavedCore(actor: DbUser, expId: string, on: boolean): Promise<void> {
  await requireVisible(expId);
  if (on) {
    await db
      .insert(s.savedExperiences)
      .values({ userId: actor.id, experienceId: expId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(s.savedExperiences)
      .where(
        sql`${s.savedExperiences.userId} = ${actor.id} and ${s.savedExperiences.experienceId} = ${expId}`,
      );
  }
}

// Every detail-page open counts (product decision 2026-06-12 — total opens,
// not unique viewers; reloads and revisits included). Still server-side and
// only fired from the page mount, so router prefetch can't inflate it.
// Callers treat this as fire-and-forget — a non-visible post is a no-op.
export async function recordViewCore(_actor: DbUser, expId: string): Promise<void> {
  await db.execute(sql`
    update experiences
       set view_count = view_count + 1
     where id = ${expId}
       and review_status = 'approved'
       and deleted_at is null
       and hidden_at is null
  `);
}
