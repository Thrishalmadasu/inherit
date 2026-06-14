// Write core for submit / edit-resubmit (PRD §7 Flows B & C).
// Pure server module — NO "use server" here: these take an explicit `actor`
// and are only reachable through the auth-gated wrappers in app/actions/*
// (and the invariant test script). Everything DB-mutating goes through ONE
// db.batch() — Neon runs a batch as a single non-interactive transaction, so
// a half-inserted experience can never exist.
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import type { ShareDraftForm } from "@/lib/draft";
import { dispatchStatus } from "@/lib/email";
import { statusEmailContent } from "@/lib/email/templates";
import {
  firstIssue,
  sanitizeShareForm,
  sharePayloadSchema,
  type SharePayload,
} from "@/lib/validations/experience";

type Batchable = Parameters<typeof db.batch>[0][number];

export class WriteError extends Error {} // safe to surface to the client

// Curated-taxonomy contract: every submitted label must resolve to an ACTIVE
// topic_tags row. Unknown labels are a bug or tampering — reject loudly.
async function resolveTagIds(payload: SharePayload): Promise<Map<string, string>> {
  const labels = [...new Set(payload.rounds.flatMap((r) => r.blocks.flatMap((b) => b.topics)))];
  if (labels.length === 0) return new Map();
  const rows = await db
    .select({ id: s.topicTags.id, label: s.topicTags.label })
    .from(s.topicTags)
    .where(and(inArray(s.topicTags.label, labels), eq(s.topicTags.isActive, true)));
  const map = new Map(rows.map((r) => [r.label, r.id]));
  const missing = labels.filter((l) => !map.has(l));
  if (missing.length) throw new WriteError(`Unknown topic tag: ${missing[0]}`);
  return map;
}

// Canonical-round contract (concern #10): every round label must be an ACTIVE
// round_types row. Students SELECT from the DB list, so an unknown label here
// is tampering or a stale client — reject loudly. `rounds.name` then stores the
// canonical label verbatim (kept in sync by the rename core in taxonomy.ts).
async function assertRoundTypes(payload: SharePayload): Promise<void> {
  const labels = [...new Set(payload.rounds.map((r) => r.round))];
  if (labels.length === 0) return;
  const rows = await db
    .select({ label: s.roundTypes.label })
    .from(s.roundTypes)
    .where(and(inArray(s.roundTypes.label, labels), eq(s.roundTypes.isActive, true)));
  const known = new Set(rows.map((r) => r.label));
  const missing = labels.filter((l) => !known.has(l));
  if (missing.length) throw new WriteError(`Unknown round type: ${missing[0]}`);
}

// Companies are NO LONGER auto-created (concern #10). Match case-insensitively
// against the canonical list (name or alias); on a hit the experience binds to
// that companyId. On a miss the typed name rides along as a PROPOSED name —
// companyId stays NULL until a moderator resolves it during review (map to an
// existing company = dedup, or promote to canonical). Ops is the single gate.
type CompanyBinding = { companyId: string | null; proposedName: string | null };

async function resolveCompany(name: string): Promise<CompanyBinding> {
  const [found] = await db
    .select({ id: s.companies.id })
    .from(s.companies)
    .where(
      sql`lower(${s.companies.name}) = ${name.toLowerCase()}
          or exists (select 1 from unnest(${s.companies.aliases}) alias
                     where lower(alias) = ${name.toLowerCase()})`,
    );
  if (found) return { companyId: found.id, proposedName: null };
  return { companyId: null, proposedName: name };
}

// Insert statements shared by create and edit: rounds → blocks → tag links →
// tips, with ids pre-generated so the whole tree fits in one batch.
function contentInserts(expId: string, payload: SharePayload, tagId: Map<string, string>): Batchable[] {
  const stmts: Batchable[] = [];
  const roundRows = payload.rounds.map((r, i) => ({
    id: randomUUID(),
    experienceId: expId,
    position: i,
    name: r.round,
    status: r.status,
    isDetailed: r.detailed,
    platform: r.platform || null,
    notes: r.note || null,
  }));
  stmts.push(db.insert(s.rounds).values(roundRows));

  const blockRows = payload.rounds.flatMap((r, ri) =>
    r.blocks.map((b, bi) => ({
      id: randomUUID(),
      roundId: roundRows[ri].id,
      position: bi,
      blockType: b.type,
      prompt: b.prompt,
      difficulty: b.difficulty,
      detail: b.detail || null,
      topics: b.topics,
    })),
  );
  if (blockRows.length) {
    stmts.push(
      db.insert(s.contentBlocks).values(blockRows.map(({ topics: _topics, ...row }) => row)),
    );
    const links = blockRows.flatMap((b) =>
      b.topics.map((label) => ({ blockId: b.id, tagId: tagId.get(label)! })),
    );
    if (links.length) stmts.push(db.insert(s.contentBlockTopicTags).values(links));
  }

  if (payload.tips.length) {
    stmts.push(
      db.insert(s.prepTips).values(
        payload.tips.map((t, i) => ({
          experienceId: expId,
          position: i,
          text: t.text,
          category: t.category,
        })),
      ),
    );
  }
  return stmts;
}

const queueNotification = (userId: string, expId: string, payload: SharePayload) =>
  db.insert(s.notifications).values({
    userId,
    type: "post_under_review" as const,
    experienceId: expId,
    payload: { company: payload.company, role: payload.role },
  });

// "It's in the queue" confirmation email (Flow D) — after the batch commits,
// best-effort (dispatchStatus never throws). The actor IS the author here.
const emailQueued = (actor: DbUser, expId: string, payload: SharePayload) =>
  dispatchStatus({
    to: actor.sstEmail,
    ...statusEmailContent("under_review", {
      authorName: actor.name,
      company: payload.company,
      role: payload.role,
      expId,
    }),
  });

// ── Flow B: new submission ───────────────────────────────────────────────────
export async function submitExperienceCore(actor: DbUser, raw: ShareDraftForm): Promise<string> {
  const parsed = sharePayloadSchema.safeParse(sanitizeShareForm(raw));
  if (!parsed.success) throw new WriteError(firstIssue(parsed.error));
  const payload = parsed.data;

  await assertRoundTypes(payload);
  const [tagId, company] = await Promise.all([
    resolveTagIds(payload),
    resolveCompany(payload.company),
  ]);

  const expId = `exp-${nanoid(12)}`;
  const stmts: Batchable[] = [
    db.insert(s.experiences).values({
      id: expId,
      authorId: actor.id,
      companyId: company.companyId,
      proposedCompanyName: company.proposedName,
      roleTitle: payload.role,
      year: payload.year,
      overallOutcome: payload.outcome,
      isAnonymous: payload.anonymous,
      reflectionText: payload.reflection || null,
      reviewStatus: "under_review",
    }),
    ...contentInserts(expId, payload, tagId),
    queueNotification(actor.id, expId, payload),
  ];
  await db.batch(stmts as [Batchable, ...Batchable[]]);
  await emailQueued(actor, expId, payload);
  return expId;
}

// ── Flow C: edit → resubmit (re-review on every edit, PRD §10) ───────────────
// Replaces the content wholesale (no version history in V1), resets review
// state, clears any Ops hide (it referred to the prior live version — the
// audit stays in moderation_actions), and re-stamps created_at: the queue is
// FIFO by created_at, so this IS "the back of the queue". An approved post
// drops out of visibleExp the moment status leaves `approved`.
export async function resubmitExperienceCore(
  actor: DbUser,
  expId: string,
  raw: ShareDraftForm,
): Promise<string> {
  const parsed = sharePayloadSchema.safeParse(sanitizeShareForm(raw));
  if (!parsed.success) throw new WriteError(firstIssue(parsed.error));
  const payload = parsed.data;

  const [existing] = await db.select().from(s.experiences).where(eq(s.experiences.id, expId));
  if (!existing || existing.authorId !== actor.id) throw new WriteError("Post not found");
  if (existing.deletedAt) throw new WriteError("Restore this post before editing it");

  await assertRoundTypes(payload);
  const [tagId, company] = await Promise.all([
    resolveTagIds(payload),
    resolveCompany(payload.company),
  ]);

  const now = new Date();
  const stmts: Batchable[] = [
    db
      .update(s.experiences)
      .set({
        companyId: company.companyId,
        proposedCompanyName: company.proposedName,
        roleTitle: payload.role,
        year: payload.year,
        overallOutcome: payload.outcome,
        isAnonymous: payload.anonymous,
        reflectionText: payload.reflection || null,
        reviewStatus: "under_review",
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        withdrawnAt: null,
        hiddenAt: null,
        hiddenBy: null,
        hiddenReason: null,
        publishedAt: null,
        createdAt: now, // queue-entry time — back of the FIFO
        updatedAt: now,
      })
      .where(eq(s.experiences.id, expId)),
    // rounds cascade to content_blocks → tag links
    db.delete(s.rounds).where(eq(s.rounds.experienceId, expId)),
    db.delete(s.prepTips).where(eq(s.prepTips.experienceId, expId)),
    ...contentInserts(expId, payload, tagId),
    queueNotification(actor.id, expId, payload),
  ];
  await db.batch(stmts as [Batchable, ...Batchable[]]);
  await emailQueued(actor, expId, payload);
  return expId;
}
