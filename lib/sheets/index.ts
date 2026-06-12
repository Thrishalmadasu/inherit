// The L&D sheet seam (roadmap #5, PRD §13). On publish, an experience's
// Technical + Behavioral rows are appended to the L&D tracker sheet —
// asynchronously (fired via after() in the approve action, outside the
// response), retried, and NEVER blocking or failing the publish itself.
//
// Driver selection mirrors lib/email: GOOGLE_SERVICE_ACCOUNT_KEY + LD_SHEET_ID
// present → Google, otherwise the console stub. SHEETS_DRIVER=console|google
// forces one (the invariant test pins console).
//
// Append-on-FIRST-publish only (PRD §13): experiences.sheet_synced_at is the
// stamp. A re-approved edit does not append again (reconciliation of edited /
// hidden posts is the deferred two-way sync). Server-only — imports the db.
import { eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { appOrigin } from "@/lib/email";
import { buildSheetRows, type SheetExperience, type SheetRows } from "./rows";
import { googleSheetSync } from "./google";

export type { SheetExperience, SheetRows } from "./rows";

export interface SheetSync {
  // Append the rows; throws on failure (the caller owns retries).
  appendPublished(rows: SheetRows): Promise<void>;
}

const consoleSheetSync: SheetSync = {
  async appendPublished(rows) {
    console.log(
      `[sheets stub] append → ${rows.technical.length} technical, ${rows.behavioral.length} behavioral row(s)` +
        [...rows.technical, ...rows.behavioral]
          .map((r) => `\n  ${r.company} · ${r.round} · ${"question" in r ? r.question : r.prompt}`)
          .join(""),
    );
  },
};

// Test seam: db/verify-write-loop.ts swaps in a capturing sync to assert
// what reaches the sheet. Never set outside tests.
let testOverride: SheetSync | null = null;
export function setSheetSyncForTest(sync: SheetSync | null): void {
  testOverride = sync;
}

export function getSheetSync(): SheetSync {
  if (testOverride) return testOverride;
  const driver =
    process.env.SHEETS_DRIVER ??
    (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.LD_SHEET_ID ? "google" : "console");
  return driver === "google" ? googleSheetSync : consoleSheetSync;
}

// Loads everything the row mapping needs. Exported for the invariant test.
export async function loadSheetExperience(expId: string): Promise<SheetExperience | null> {
  const [exp] = await db
    .select({
      id: s.experiences.id,
      role: s.experiences.roleTitle,
      year: s.experiences.year,
      publishedAt: s.experiences.publishedAt,
      company: s.companies.name,
    })
    .from(s.experiences)
    .innerJoin(s.companies, eq(s.companies.id, s.experiences.companyId))
    .where(eq(s.experiences.id, expId));
  if (!exp) return null;

  const rounds = await db
    .select()
    .from(s.rounds)
    .where(eq(s.rounds.experienceId, expId))
    .orderBy(s.rounds.position);
  const roundIds = rounds.map((r) => r.id);
  const blocks = roundIds.length
    ? await db
        .select()
        .from(s.contentBlocks)
        .where(inArray(s.contentBlocks.roundId, roundIds))
        .orderBy(s.contentBlocks.position)
    : [];
  const blockIds = blocks.map((b) => b.id);
  const tagRows = blockIds.length
    ? await db
        .select({
          blockId: s.contentBlockTopicTags.blockId,
          label: s.topicTags.label,
          category: s.topicTags.category,
          isDsa: s.topicTags.isDsa,
        })
        .from(s.contentBlockTopicTags)
        .innerJoin(s.topicTags, eq(s.topicTags.id, s.contentBlockTopicTags.tagId))
        .where(inArray(s.contentBlockTopicTags.blockId, blockIds))
    : [];

  return {
    ...exp,
    rounds: rounds.map((round) => ({
      name: round.name,
      platform: round.platform,
      blocks: blocks
        .filter((b) => b.roundId === round.id)
        .map((b) => ({
          blockType: b.blockType,
          prompt: b.prompt,
          difficulty: b.difficulty,
          detail: b.detail,
          tags: tagRows
            .filter((t) => t.blockId === b.id)
            .map(({ label, category, isDsa }) => ({ label, category, isDsa })),
        })),
    })),
  };
}

const RETRY_BACKOFF_MS = [1_000, 4_000]; // 3 attempts total, within after()'s window
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The fire-and-forget entry point — called from after() in the approve
// action and from the invariant test. Never throws: a sheet outage logs and
// leaves sheet_synced_at NULL (the post stays published; PRD's durable
// job-queue worker is deferred — see HANDBOOK §10 hardening).
export async function syncPublishedExperience(expId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        reviewStatus: s.experiences.reviewStatus,
        deletedAt: s.experiences.deletedAt,
        hiddenAt: s.experiences.hiddenAt,
        sheetSyncedAt: s.experiences.sheetSyncedAt,
      })
      .from(s.experiences)
      .where(eq(s.experiences.id, expId));
    // Only live posts, only once — re-checked here (not just at the call
    // site) because after() runs later than the approve that scheduled it.
    if (!row || row.reviewStatus !== "approved" || row.deletedAt || row.hiddenAt) return;
    if (row.sheetSyncedAt) return;

    const exp = await loadSheetExperience(expId);
    if (!exp) return;
    const rows = buildSheetRows(exp, appOrigin());
    if (rows.technical.length || rows.behavioral.length) {
      const sync = getSheetSync();
      for (let attempt = 0; ; attempt++) {
        try {
          await sync.appendPublished(rows);
          break;
        } catch (err) {
          if (attempt >= RETRY_BACKOFF_MS.length) throw err;
          await sleep(RETRY_BACKOFF_MS[attempt]);
        }
      }
    }
    await db
      .update(s.experiences)
      .set({ sheetSyncedAt: new Date() })
      .where(eq(s.experiences.id, expId));
  } catch (err) {
    console.error(`[sheets] sync for ${expId} failed (post stays published):`, err);
  }
}
