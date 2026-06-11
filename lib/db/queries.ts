// Read queries. THE visibility invariant lives here once, not per-screen:
// a student-facing experience is approved AND not author-deleted AND not
// Ops-hidden. Every read path goes through `visibleExp`.
//
// Rows are mapped to the existing card/detail shapes (lib/mock/data types) so
// the client views stay unchanged — that DTO becomes lib/types in Phase 2.
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type {
  CompanyListItem,
  Experience,
  PrepTip,
  QuestionDetail,
  RoundEntry,
} from "@/lib/mock/data";

const visibleExp = and(
  eq(s.experiences.reviewStatus, "approved"),
  isNull(s.experiences.deletedAt),
  isNull(s.experiences.hiddenAt),
);

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "";
const batchOf = (year: number | null) => (year ? `'${String(year).slice(2)}` : "'27");
const daysSince = (d: Date | null) =>
  d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : 999;

// ── Load + map all visible experiences (small dataset; aggregate in JS) ──────
type Loaded = {
  exp: typeof s.experiences.$inferSelect;
  company: typeof s.companies.$inferSelect;
  author: typeof s.users.$inferSelect;
  rounds: (typeof s.rounds.$inferSelect & {
    blocks: (typeof s.contentBlocks.$inferSelect & { tags: string[] })[];
  })[];
  tips: (typeof s.prepTips.$inferSelect)[];
};

async function loadVisible(): Promise<Loaded[]> {
  const exps = await db
    .select()
    .from(s.experiences)
    .innerJoin(s.companies, eq(s.experiences.companyId, s.companies.id))
    .innerJoin(s.users, eq(s.experiences.authorId, s.users.id))
    .where(visibleExp)
    .orderBy(desc(s.experiences.publishedAt));
  if (exps.length === 0) return [];

  const ids = exps.map((r) => r.experiences.id);
  const rounds = await db
    .select()
    .from(s.rounds)
    .where(inArray(s.rounds.experienceId, ids))
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
  const links = blockIds.length
    ? await db
        .select({
          blockId: s.contentBlockTopicTags.blockId,
          label: s.topicTags.label,
        })
        .from(s.contentBlockTopicTags)
        .innerJoin(s.topicTags, eq(s.contentBlockTopicTags.tagId, s.topicTags.id))
        .where(inArray(s.contentBlockTopicTags.blockId, blockIds))
    : [];
  const tips = await db
    .select()
    .from(s.prepTips)
    .where(inArray(s.prepTips.experienceId, ids))
    .orderBy(s.prepTips.position);

  const tagsByBlock = new Map<string, string[]>();
  for (const l of links) {
    const arr = tagsByBlock.get(l.blockId) ?? [];
    arr.push(l.label);
    tagsByBlock.set(l.blockId, arr);
  }
  const blocksByRound = new Map<string, Loaded["rounds"][number]["blocks"]>();
  for (const b of blocks) {
    const arr = blocksByRound.get(b.roundId) ?? [];
    arr.push({ ...b, tags: tagsByBlock.get(b.id) ?? [] });
    blocksByRound.set(b.roundId, arr);
  }

  return exps.map((r) => ({
    exp: r.experiences,
    company: r.companies,
    author: r.users,
    rounds: rounds
      .filter((rd) => rd.experienceId === r.experiences.id)
      .map((rd) => ({ ...rd, blocks: blocksByRound.get(rd.id) ?? [] })),
    tips: tips.filter((t) => t.experienceId === r.experiences.id),
  }));
}

// ── Mapping to the card/detail DTO ───────────────────────────────────────────
function toRoundEntries(l: Loaded): RoundEntry[] {
  return l.rounds.map((rd) => {
    const diffs = rd.blocks.map((b) => b.difficulty).filter((d): d is number => d != null);
    return {
      round: rd.name,
      status: rd.status,
      questions: rd.blocks.length,
      avgDifficulty: diffs.length
        ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
        : undefined,
      platform: rd.platform ?? undefined,
    };
  });
}

function toCard(l: Loaded): Experience {
  const single = l.rounds.length === 1 ? l.rounds[0] : null;
  return {
    id: l.exp.id,
    author: {
      name: l.exp.isAnonymous ? null : l.author.name,
      batch: batchOf(l.author.batchYear),
      anonymous: l.exp.isAnonymous,
    },
    role: l.exp.roleTitle,
    year: l.exp.year,
    submittedAt: fmtDate(l.exp.publishedAt),
    helpful: l.exp.helpfulCount,
    views: l.exp.viewCount,
    excerpt: l.exp.overview ?? undefined,
    company: l.company.name,
    ...(single
      ? {
          round: single.name,
          outcome: l.exp.overallOutcome,
          questions: single.blocks.length,
          avgDifficulty: toRoundEntries(l)[0].avgDifficulty,
          platform: single.platform ?? undefined,
        }
      : { rounds: toRoundEntries(l), overallOutcome: l.exp.overallOutcome }),
  };
}

function toDetail(l: Loaded): Experience {
  const card = toCard(l);
  const allBlocks = l.rounds.flatMap((rd) =>
    rd.blocks.map((b) => ({ b, platform: rd.platform })),
  );
  const questionsList: QuestionDetail[] = allBlocks.map(({ b, platform }, i) => ({
    n: i + 1,
    topic: b.tags.length ? b.tags.join(" · ") : blockTypeLabel(b.blockType),
    difficulty: b.difficulty ?? 0,
    platform: platform ?? "",
    time: "",
    summary: b.prompt,
    approach: b.detail ?? "",
  }));
  const topics = [...new Set(allBlocks.flatMap(({ b }) => b.tags))];
  return {
    ...card,
    round: card.round ?? l.rounds[0]?.name,
    outcome: l.exp.overallOutcome,
    overview: l.exp.overview ?? undefined,
    reflection: l.exp.reflectionText ?? undefined,
    duration: l.exp.durationMinutes ? `${l.exp.durationMinutes} min` : undefined,
    questionsList: questionsList.length ? questionsList : undefined,
    prepTips: l.tips.length
      ? l.tips.map((t): PrepTip => ({ category: t.category, text: t.text }))
      : undefined,
    topics: topics.length ? topics : undefined,
  };
}

const blockTypeLabel = (t: string) =>
  ({ coding: "Coding", system_design: "System design", behavioral: "Behavioral", open: "Open" })[t] ?? t;

// ── Public queries ───────────────────────────────────────────────────────────
export async function listCompanies(): Promise<CompanyListItem[]> {
  const [companies, visible] = await Promise.all([
    db.select().from(s.companies).orderBy(s.companies.name),
    loadVisible(),
  ]);
  return companies
    .map((c) => {
      const exps = visible.filter((l) => l.company.id === c.id);
      const latest = exps[0]?.exp.publishedAt ?? null;
      return {
        slug: c.slug,
        name: c.name,
        industry: c.industry ?? "",
        count: exps.length,
        active: false, // recruiting status is a deferred feature (V1)
        lastDays: daysSince(latest),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface CompanyPageData {
  slug: string;
  name: string;
  industry: string;
  location: string;
  totalExperiences: number;
  years: number[];
  lastDays: number;
  breakdown: Record<string, number>;
  roles: { name: string; count: number }[];
  commonPath: string[];
  pathFunnel: number[];
  topTopics: { name: string; count: number }[];
  experiences: Experience[];
}

export async function getCompanyPage(slug: string): Promise<CompanyPageData | null> {
  const [company] = await db.select().from(s.companies).where(eq(s.companies.slug, slug));
  if (!company) return null;
  const visible = (await loadVisible()).filter((l) => l.company.id === company.id);

  // Funnel: count experiences reaching each round label, ordered by avg position.
  const roundAgg = new Map<string, { count: number; posSum: number }>();
  for (const l of visible)
    for (const rd of l.rounds) {
      const a = roundAgg.get(rd.name) ?? { count: 0, posSum: 0 };
      a.count += 1;
      a.posSum += rd.position;
      roundAgg.set(rd.name, a);
    }
  const ordered = [...roundAgg.entries()].sort(
    (a, b) => a[1].posSum / a[1].count - b[1].posSum / b[1].count,
  );

  // Top topics: tag frequency across all blocks.
  const topicCount = new Map<string, number>();
  for (const l of visible)
    for (const rd of l.rounds)
      for (const b of rd.blocks)
        for (const t of b.tags) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);

  // Roles
  const roleCount = new Map<string, number>();
  for (const l of visible)
    roleCount.set(l.exp.roleTitle, (roleCount.get(l.exp.roleTitle) ?? 0) + 1);

  return {
    slug: company.slug,
    name: company.name,
    industry: company.industry ?? "",
    location: company.location ?? "",
    totalExperiences: visible.length,
    years: [...new Set(visible.map((l) => l.exp.year))].sort((a, b) => b - a),
    lastDays: daysSince(visible[0]?.exp.publishedAt ?? null),
    breakdown: Object.fromEntries(ordered.map(([name, a]) => [name, a.count])),
    roles: [...roleCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    commonPath: ordered.map(([name]) => name),
    pathFunnel: ordered.map(([, a]) => a.count),
    topTopics: [...topicCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7),
    experiences: visible.map(toCard),
  };
}

export async function getExperience(
  id: string,
): Promise<{ exp: Experience; related: Experience[]; company: { name: string; slug: string; industry: string } } | null> {
  const visible = await loadVisible();
  const found = visible.find((l) => l.exp.id === id);
  if (!found) return null;
  const related = visible
    .filter((l) => l.company.id === found.company.id && l.exp.id !== id)
    .slice(0, 4)
    .map(toCard);
  return {
    exp: toDetail(found),
    related,
    company: {
      name: found.company.name,
      slug: found.company.slug,
      industry: found.company.industry ?? "",
    },
  };
}

export async function listFeed(): Promise<Experience[]> {
  return (await loadVisible()).map(toCard);
}

export async function latestExperiences(n: number): Promise<Experience[]> {
  return (await loadVisible()).slice(0, n).map(toCard);
}
