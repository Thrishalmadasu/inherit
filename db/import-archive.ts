// Import the reviewed archive dataset (db/archive-data.ts) into the DB: full
// reset, re-seed canonical taxonomy, then load genuine experiences attributed
// to the anonymous "SST Archive" user (isAnonymous + importedFromArchive,
// approved + published).
//
//   Dev:  npx tsx --env-file=.env.local db/import-archive.ts
//   Prod: DATABASE_URL=<prod> npx tsx db/import-archive.ts --prod-confirm
//
// Mirrors db/seed.ts's insert sequence. Run drizzle-kit migrate first on a
// fresh schema. Sends NO email (direct inserts bypass the write/email seam).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as s from "../lib/db/schema";
import { ROLE_TYPE_SEED, TOPIC_TAXONOMY } from "../lib/share-form";
import { ARCHIVE_COMPANIES, ARCHIVE_TOPICS_TO_ADD, ARCHIVE_EXPERIENCES } from "./archive-data";

const PROD_ENDPOINT = "ep-delicate-frost-ao4tdzc7";
const url = process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL not set");
if (url.includes(PROD_ENDPOINT) && !process.argv.includes("--prod-confirm")) {
  throw new Error("Refusing: DATABASE_URL points at PROD. Pass --prod-confirm to import into production.");
}

const db = drizzle(neon(url), { schema: s });
const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Owner (regains Ops access after the reset) + the anonymous archive author.
const SUPER_ADMIN = {
  name: "Thrishal M.",
  sstEmail: "thrishal.23bcs10115@sst.scaler.com",
  role: "super_admin" as const,
  batchYear: 2027,
};
const ARCHIVE_USER = {
  name: "SST Archive",
  // Subdomain that can't match the @sst.scaler.com Clerk allowlist and has no
  // real inbox — unclaimable, never authenticates. See plan: archive identity.
  sstEmail: "archive@inherit.sst.scaler.com",
  role: "student" as const,
  batchYear: null,
};

async function main() {
  console.log(`Target: ${new URL(url).hostname}`);
  console.log("Wiping… (full reset, FK-safe order)");
  await db.delete(s.contentBlockTopicTags);
  await db.delete(s.contentBlocks);
  await db.delete(s.prepTips);
  await db.delete(s.reactions);
  await db.delete(s.savedExperiences);
  await db.delete(s.notifications);
  await db.delete(s.moderationActions);
  await db.delete(s.flags);
  await db.delete(s.rounds);
  await db.delete(s.experiences);
  await db.delete(s.inviteRecipients);
  await db.delete(s.inviteCampaigns);
  await db.delete(s.roleChangeAudit);
  await db.delete(s.topicTags);
  await db.delete(s.roundTypes);
  await db.delete(s.roleTypes);
  await db.delete(s.companies);
  await db.delete(s.users);

  console.log("Users…");
  const userRows = await db.insert(s.users).values([SUPER_ADMIN, ARCHIVE_USER]).returning();
  const adminId = userRows.find((u) => u.role === "super_admin")!.id;
  const archiveId = userRows.find((u) => u.sstEmail === ARCHIVE_USER.sstEmail)!.id;

  console.log("Companies…");
  const companyRows = await db
    .insert(s.companies)
    .values(
      ARCHIVE_COMPANIES.map((c) => ({
        name: c.name,
        slug: slugify(c.name),
        industry: c.industry,
        aliases: c.aliases ?? [],
      })),
    )
    .returning();
  const companyId = new Map(companyRows.map((c) => [c.name, c.id]));

  console.log("Topic taxonomy…");
  const allTopics = [...TOPIC_TAXONOMY, ...ARCHIVE_TOPICS_TO_ADD];
  const tagRows = await db
    .insert(s.topicTags)
    .values(
      allTopics.map((t) => ({
        label: t.label,
        slug: slugify(t.label),
        category: t.category as (typeof s.tagCategory.enumValues)[number],
        isDsa: t.category === "dsa",
      })),
    )
    .returning();
  const tagId = new Map(tagRows.map((t) => [t.label, t.id]));

  console.log("Round types…");
  // Round types = every distinct round name actually used by the experiences,
  // so the canonical list and the data stay in sync by construction. Ordered by
  // a preferred priority, then the rest alphabetically.
  const ROUND_TYPE_PRIORITY = [
    "OA",
    "Tech + Behavioural",
    "Tech + Gen AI",
    "Gen AI",
    "Technical Interview",
    "ML Round",
    "System Design",
    "HR",
    "Hiring Manager",
    "Behavioural",
    "Product Intern",
  ];
  const usedRoundNames = [...new Set(ARCHIVE_EXPERIENCES.flatMap((e) => e.rounds.map((r) => r.name)))];
  const roundTypeLabels = [
    ...ROUND_TYPE_PRIORITY.filter((p) => usedRoundNames.includes(p)),
    ...usedRoundNames.filter((n) => !ROUND_TYPE_PRIORITY.includes(n)).sort(),
  ];
  await db
    .insert(s.roundTypes)
    .values(roundTypeLabels.map((label, i) => ({ label, slug: slugify(label), position: i })));

  console.log("Role types…");
  const roleRows = await db
    .insert(s.roleTypes)
    .values(ROLE_TYPE_SEED.map((label) => ({ label, slug: slugify(label) })))
    .returning();
  const roleTypeId = new Map(roleRows.map((r) => [r.label, r.id]));

  console.log("Experiences…");
  // Published "now" (import time) — these are freshly added to Inherit. Spaced
  // ~20 min apart so the feed has a stable order without odd back-dating.
  const BASE = Date.now();
  const missingTopics = new Set<string>();
  const missingCompanies = new Set<string>();
  let roundCount = 0;
  let blockCount = 0;

  for (const [ei, e] of ARCHIVE_EXPERIENCES.entries()) {
    const cId = companyId.get(e.company);
    if (!cId) {
      missingCompanies.add(e.company);
      continue; // never import an experience with no canonical company
    }
    const id = `arc-${String(ei + 1).padStart(4, "0")}`;
    const published = new Date(BASE - ei * 20 * 60_000); // ~20 min apart, all "today"

    await db.insert(s.experiences).values({
      id,
      authorId: archiveId,
      companyId: cId,
      roleTitle: e.role,
      roleTypeId: roleTypeId.get(e.role) ?? null,
      year: e.year,
      overallOutcome: e.outcome,
      isAnonymous: true,
      reviewStatus: "approved",
      reviewedBy: adminId,
      reviewedAt: published,
      importedFromArchive: true,
      createdAt: published,
      updatedAt: published,
      publishedAt: published,
    });

    for (const [ri, r] of e.rounds.entries()) {
      const [round] = await db
        .insert(s.rounds)
        .values({
          experienceId: id,
          position: ri,
          name: r.name,
          status: r.status,
          isDetailed: r.blocks.length > 0,
          platform: r.platform ?? null,
        })
        .returning();
      roundCount++;

      for (const [bi, b] of r.blocks.entries()) {
        const [block] = await db
          .insert(s.contentBlocks)
          .values({
            roundId: round.id,
            position: bi,
            blockType: b.type,
            prompt: b.prompt,
            detail: b.detail ?? null,
          })
          .returning();
        blockCount++;

        const links = (b.topics ?? [])
          .map((label) => {
            const tid = tagId.get(label);
            if (!tid) missingTopics.add(label);
            return tid;
          })
          .filter((x): x is string => !!x)
          .map((tid) => ({ blockId: block.id, tagId: tid }));
        if (links.length) await db.insert(s.contentBlockTopicTags).values(links);
      }
    }

    if (e.tips?.length) {
      await db
        .insert(s.prepTips)
        .values(e.tips.map((t, i) => ({ experienceId: id, position: i, ...t })));
    }
  }

  const [{ n: expCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.experiences);
  const [{ n: companyCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.companies);
  console.log(
    `Done: ${expCount} experiences, ${roundCount} rounds, ${blockCount} blocks, ${companyCount} companies.`,
  );
  if (missingCompanies.size) console.warn("⚠ skipped (no canonical company):", [...missingCompanies].join(", "));
  if (missingTopics.size) console.warn("⚠ unmapped topic labels (left untagged):", [...missingTopics].join(", "));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
