// Read queries. THE visibility invariant lives here once, not per-screen:
// a student-facing experience is approved AND not author-deleted AND not
// Ops-hidden. Every read path goes through `visibleExp`.
//
// Rows are mapped to the shared DTO shapes (lib/types.ts) so the client
// views stay unchanged.
import { and, asc, count, desc, eq, ilike, inArray, isNull, max, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema as s } from "@/lib/db";
import type {
  CompanyListItem,
  Experience,
  MyPost,
  OpsPublishedItem,
  OpsQueueItem,
  PrepTip,
  QuestionDetail,
  ReviewStatus,
  RoundEntry,
} from "@/lib/types";
import type { ShareDraftForm } from "@/lib/draft";
import type { ShareFormOptions } from "@/lib/share-form";

const visibleExp = and(
  eq(s.experiences.reviewStatus, "approved"),
  isNull(s.experiences.deletedAt),
  isNull(s.experiences.hiddenAt),
);

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "";
// Exit-year batch label ('27, '28, …) from the stored entry-year+4. Empty when
// unknown (e.g. an allowlisted external/staff email that carries no batch) -
// callers must render an empty batch gracefully (no dangling separators).
const batchOf = (year: number | null) => (year ? `'${String(year).slice(2)}` : "");
// Display company name: the canonical row's name, or the proposed name for an
// as-yet-unresolved under-review post (author/Ops surfaces only).
const companyNameOf = (l: Loaded) => l.company?.name ?? l.exp.proposedCompanyName ?? "-";
const daysSince = (d: Date | null) =>
  d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : 999;

// ── Load + map all visible experiences (small dataset; aggregate in JS) ──────
type Loaded = {
  exp: typeof s.experiences.$inferSelect;
  // null only for under-review posts naming a not-yet-canonical (proposed)
  // company - those surface ONLY in author/Ops reads. Every visibleExp row has
  // a company (approval requires the proposed name be resolved first).
  company: typeof s.companies.$inferSelect | null;
  author: typeof s.users.$inferSelect;
  rounds: (typeof s.rounds.$inferSelect & {
    blocks: (typeof s.contentBlocks.$inferSelect & { tags: string[] })[];
  })[];
  tips: (typeof s.prepTips.$inferSelect)[];
};

async function loadWhere(
  where: SQL | undefined,
  orderBy: SQL,
  limit?: number,
  offset?: number,
): Promise<Loaded[]> {
  const base = db
    .select()
    .from(s.experiences)
    .leftJoin(s.companies, eq(s.experiences.companyId, s.companies.id))
    .innerJoin(s.users, eq(s.experiences.authorId, s.users.id))
    .where(where)
    .orderBy(orderBy);
  const exps = await (limit != null ? base.limit(limit).offset(offset ?? 0) : base);
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

  return exps.map((r): Loaded => ({
    exp: r.experiences,
    company: r.companies,
    author: r.users,
    rounds: rounds
      .filter((rd) => rd.experienceId === r.experiences.id)
      .map((rd) => ({ ...rd, blocks: blocksByRound.get(rd.id) ?? [] })),
    tips: tips.filter((t) => t.experienceId === r.experiences.id),
  }));
}

const loadVisible = () => loadWhere(visibleExp, desc(s.experiences.publishedAt));

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
    company: companyNameOf(l),
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
  // Per-company count + latest publish date aggregated in SQL (GROUP BY) -
  // no experience hydration, no full-corpus scan.
  const [companies, stats] = await Promise.all([
    db.select().from(s.companies).orderBy(s.companies.name),
    db
      .select({
        companyId: s.experiences.companyId,
        count: count(),
        latest: max(s.experiences.publishedAt),
      })
      .from(s.experiences)
      .where(visibleExp)
      .groupBy(s.experiences.companyId),
  ]);
  const byCompany = new Map(stats.map((r) => [r.companyId, r]));
  return companies
    .map((c) => {
      const stat = byCompany.get(c.id);
      return {
        slug: c.slug,
        name: c.name,
        industry: c.industry ?? "",
        count: stat?.count ?? 0,
        active: false, // recruiting status is a deferred feature (V1)
        lastDays: daysSince(stat?.latest ?? null),
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
  const visible = await loadWhere(
    and(visibleExp, eq(s.experiences.companyId, company.id)),
    desc(s.experiences.publishedAt),
  );

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
  const [found] = await loadWhere(and(visibleExp, eq(s.experiences.id, id)), desc(s.experiences.publishedAt));
  if (!found || !found.company) return null; // visible ⇒ company always set
  const company = found.company;
  // ≤4 related from the same company - scoped in SQL, not a full-corpus scan.
  const relatedRows = await loadWhere(
    and(visibleExp, eq(s.experiences.companyId, company.id), ne(s.experiences.id, id)),
    desc(s.experiences.publishedAt),
    4,
  );
  const related = relatedRows.map(toCard);
  return {
    exp: toDetail(found),
    related,
    company: {
      name: company.name,
      slug: company.slug,
      industry: company.industry ?? "",
    },
  };
}

export async function listFeed(): Promise<Experience[]> {
  return (await loadVisible()).map(toCard);
}

export async function latestExperiences(n: number): Promise<Experience[]> {
  const rows = await loadWhere(visibleExp, desc(s.experiences.publishedAt), n);
  return rows.map(toCard);
}

// Server-side experience search (Tier-3) - matches role / company / round name,
// bounded by `limit`, so /search no longer loads the whole corpus to filter.
export async function searchExperiences(q: string, limit = 20): Promise<Experience[]> {
  const t = q.trim();
  if (!t) return [];
  const like = `%${t}%`;
  const where = and(
    visibleExp,
    or(
      ilike(s.experiences.roleTitle, like),
      ilike(s.companies.name, like),
      sql`exists (select 1 from ${s.rounds} where ${s.rounds.experienceId} = ${s.experiences.id} and ${s.rounds.name} ilike ${like})`,
    ),
  );
  const rows = await loadWhere(where, desc(s.experiences.publishedAt), limit);
  return rows.map(toCard);
}

// ── Paginated feed (Tier-3): filter + sort + paginate in SQL ─────────────────
// The /feed and /search filtering/sorting used to run in the client over the
// WHOLE corpus. Doing it server-side means a page load fetches one bounded page
// and the sort spans the full dataset correctly.
export type FeedSort = "latest" | "helpful" | "views" | "difficulty";
export interface FeedQuery {
  round?: string; // "all" | round name | "Tech" (prefix match)
  outcome?: string; // "all" | overall_outcome enum value
  sort?: FeedSort;
  page?: number;
  pageSize?: number;
}
export interface FeedPage {
  items: Experience[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function listFeedPage(opts: FeedQuery = {}): Promise<FeedPage> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 50);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const conds: (SQL | undefined)[] = [visibleExp];
  const outcome = opts.outcome && opts.outcome !== "all" ? opts.outcome : null;
  if (outcome && (s.overallOutcome.enumValues as readonly string[]).includes(outcome))
    conds.push(
      eq(s.experiences.overallOutcome, outcome as (typeof s.overallOutcome.enumValues)[number]),
    );
  const round = opts.round && opts.round !== "all" ? opts.round : null;
  if (round) {
    const nameCond =
      round === "Tech" ? sql`${s.rounds.name} ilike 'Tech%'` : sql`${s.rounds.name} = ${round}`;
    conds.push(
      sql`exists (select 1 from ${s.rounds} where ${s.rounds.experienceId} = ${s.experiences.id} and ${nameCond})`,
    );
  }
  const where = and(...conds);

  // Deterministic tiebreaker (id) keeps offset pages stable across equal sort keys.
  const tie = sql`${s.experiences.id} desc`;
  const orderBy =
    opts.sort === "helpful"
      ? sql`${s.experiences.helpfulCount} desc, ${tie}`
      : opts.sort === "views"
        ? sql`${s.experiences.viewCount} desc, ${tie}`
        : opts.sort === "difficulty"
          ? sql`(select avg(${s.contentBlocks.difficulty}) from ${s.contentBlocks} inner join ${s.rounds} on ${s.contentBlocks.roundId} = ${s.rounds.id} where ${s.rounds.experienceId} = ${s.experiences.id}) desc nulls last, ${tie}`
          : sql`${s.experiences.publishedAt} desc nulls last, ${tie}`;

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(s.experiences).where(where),
    loadWhere(where, orderBy, pageSize, offset),
  ]);

  return { items: rows.map(toCard), total, page, pageSize, hasMore: offset + rows.length < total };
}

// ── Engagement reads (Session 3) ─────────────────────────────────────────────

// Has THIS viewer already marked helpful / saved? Seeds the detail-page
// buttons so the optimistic UI starts from truth.
export async function getViewerEngagement(
  userId: string,
  expId: string,
): Promise<{ helpful: boolean; saved: boolean }> {
  const [reaction, savedRow] = await Promise.all([
    db
      .select({ id: s.reactions.id })
      .from(s.reactions)
      .where(and(eq(s.reactions.userId, userId), eq(s.reactions.experienceId, expId))),
    db
      .select({ id: s.savedExperiences.experienceId })
      .from(s.savedExperiences)
      .where(
        and(
          eq(s.savedExperiences.userId, userId),
          eq(s.savedExperiences.experienceId, expId),
        ),
      ),
  ]);
  return { helpful: reaction.length > 0, saved: savedRow.length > 0 };
}

// The viewer's bookmarks, most recently saved first. Goes through visibleExp:
// a saved post that later gets hidden/deleted/unpublished silently drops out
// (the save row stays, so it reappears if the post comes back).
export interface Paginated<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

const pageBounds = (page?: number, pageSize?: number, max = 50) => {
  const size = Math.min(Math.max(pageSize ?? 20, 1), max);
  const p = Math.max(page ?? 1, 1);
  return { size, offset: (p - 1) * size };
};

export async function getSavedExperiences(
  userId: string,
  opts?: { page?: number; pageSize?: number },
): Promise<Paginated<Experience>> {
  const { size, offset } = pageBounds(opts?.page, opts?.pageSize);
  // Join saved → experiences so the visibility invariant (hidden/deleted drop
  // out) is applied BEFORE paginating - total + page stay consistent.
  const base = and(eq(s.savedExperiences.userId, userId), visibleExp);
  const savedJoin = db
    .select({ experienceId: s.savedExperiences.experienceId, savedAt: s.savedExperiences.createdAt })
    .from(s.savedExperiences)
    .innerJoin(s.experiences, eq(s.experiences.id, s.savedExperiences.experienceId))
    .where(base);

  const [[{ total }], idRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(s.savedExperiences)
      .innerJoin(s.experiences, eq(s.experiences.id, s.savedExperiences.experienceId))
      .where(base),
    savedJoin.orderBy(desc(s.savedExperiences.createdAt)).limit(size).offset(offset),
  ]);
  if (idRows.length === 0) return { items: [], total, hasMore: false };

  const order = new Map(idRows.map((r, i) => [r.experienceId, i]));
  const rows = await loadWhere(
    and(visibleExp, inArray(s.experiences.id, idRows.map((r) => r.experienceId))),
    desc(s.experiences.publishedAt),
  );
  const items = rows
    .sort((a, b) => (order.get(a.exp.id) ?? 0) - (order.get(b.exp.id) ?? 0))
    .map(toCard);
  return { items, total, hasMore: offset + idRows.length < total };
}

// ── Author-facing reads (write loop, Session 2) ──────────────────────────────
// These deliberately do NOT use visibleExp: an author always sees their own
// posts; Ops sees the pending queue. Student-facing surfaces above remain the
// only consumers of the visibility invariant.

const agoOf = (d: Date | null) => {
  const diff = Math.max(0, Date.now() - (d?.getTime() ?? 0));
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
};

// Author delete trumps everything; Ops hide applies to approved; withdrawn is
// an under_review the author pulled back.
function statusOf(e: typeof s.experiences.$inferSelect): ReviewStatus {
  if (e.deletedAt) return "Deleted";
  if (e.hiddenAt) return "Hidden";
  if (e.reviewStatus === "under_review")
    return e.withdrawnAt ? "Withdrawn" : "Under Review";
  if (e.reviewStatus === "approved") return "Approved";
  if (e.reviewStatus === "needs_edits") return "Needs Edits";
  return "Rejected";
}

export async function getMyPosts(userId: string): Promise<MyPost[]> {
  const mine = await loadWhere(
    eq(s.experiences.authorId, userId),
    desc(s.experiences.updatedAt),
  );
  return mine.map((l) => {
    const status = statusOf(l.exp);
    return {
      id: l.exp.id,
      company: companyNameOf(l),
      role: l.exp.roleTitle,
      overallOutcome: l.exp.overallOutcome,
      status,
      submittedAt: fmtDate(l.exp.createdAt),
      updatedAt: fmtDate(l.exp.updatedAt),
      deletedAt: l.exp.deletedAt ? fmtDate(l.exp.deletedAt) : undefined,
      tips: l.tips.length,
      views: l.exp.viewCount,
      helpful: l.exp.helpfulCount,
      opsNote:
        (status === "Needs Edits" || status === "Rejected") && l.exp.reviewNotes
          ? l.exp.reviewNotes
          : undefined,
      hiddenReason: l.exp.hiddenReason ?? undefined,
      hiddenAt: l.exp.hiddenAt ? fmtDate(l.exp.hiddenAt) : undefined,
      rounds: toRoundEntries(l),
    };
  });
}

// The author's newest live submission awaiting review - the /under-review page
// and the dashboard strip. Withdrawn/deleted posts don't count.
const pendingFor = (userId: string) =>
  and(
    eq(s.experiences.authorId, userId),
    eq(s.experiences.reviewStatus, "under_review"),
    isNull(s.experiences.withdrawnAt),
    isNull(s.experiences.deletedAt),
  );

export interface PendingPreview {
  id: string;
  exp: Experience;
  companyName: string;
  companyIndustry: string;
  submittedAgo: string;
}

export async function getMyPendingPost(userId: string): Promise<PendingPreview | null> {
  const rows = await loadWhere(pendingFor(userId), desc(s.experiences.createdAt));
  const l = rows[0];
  if (!l) return null;
  return {
    id: l.exp.id,
    exp: toDetail(l),
    companyName: companyNameOf(l),
    companyIndustry: l.company?.industry ?? "",
    submittedAgo: agoOf(l.exp.createdAt),
  };
}

// ── Ops reads ────────────────────────────────────────────────────────────────
// FIFO is the product promise (PRD §10): oldest created_at first, no
// fast-tracking. Resubmissions re-stamp created_at, which is what sends them
// to the back of this very ordering.
export async function getOpsQueue(opts?: {
  anonymousOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<OpsQueueItem>> {
  const { size, offset } = pageBounds(opts?.page, opts?.pageSize);
  const where = and(
    eq(s.experiences.reviewStatus, "under_review"),
    isNull(s.experiences.withdrawnAt),
    isNull(s.experiences.deletedAt),
    opts?.anonymousOnly ? eq(s.experiences.isAnonymous, true) : undefined,
  );
  const [[{ total }], pending] = await Promise.all([
    db.select({ total: count() }).from(s.experiences).where(where),
    loadWhere(where, asc(s.experiences.createdAt), size, offset),
  ]);
  const items = pending.map((l): OpsQueueItem => ({
    id: l.exp.id,
    realAuthor: {
      name: l.author.name,
      batch: batchOf(l.author.batchYear),
      email: l.author.sstEmail,
    },
    bylineAs: l.exp.isAnonymous ? "anonymous" : "real",
    company: companyNameOf(l),
    // Proposed (not-yet-canonical) company awaiting moderator resolution
    // (concern #10). Null once bound to a canonical company.
    proposedCompany: l.exp.companyId ? null : (l.exp.proposedCompanyName ?? null),
    role: l.exp.roleTitle,
    round: l.rounds[0]?.name ?? "-",
    outcome: l.exp.overallOutcome,
    submittedAgo: agoOf(l.exp.createdAt),
    questions: l.rounds.reduce((n, r) => n + r.blocks.length, 0),
    tips: l.tips.length,
    hasReflection: Boolean(l.exp.reflectionText?.trim()),
    overview: l.exp.overview ?? "",
    detail: toDetail(l),
  }));
  return { items, total, hasMore: offset + pending.length < total };
}

// Published view for Ops: approved & not author-deleted - hidden posts stay
// listed (flagged) so they can be unhidden.
export async function listOpsPublished(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<Paginated<OpsPublishedItem>> {
  const { size, offset } = pageBounds(opts?.page, opts?.pageSize);
  const where = and(eq(s.experiences.reviewStatus, "approved"), isNull(s.experiences.deletedAt));
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(s.experiences).where(where),
    loadWhere(where, desc(s.experiences.publishedAt), size, offset),
  ]);
  const items = rows.map((l) => ({
    id: l.exp.id,
    company: companyNameOf(l),
    role: l.exp.roleTitle,
    round: l.rounds[0]?.name ?? "-",
    outcome: l.exp.overallOutcome,
    publishedAt: fmtDate(l.exp.publishedAt),
    views: l.exp.viewCount,
    helpful: l.exp.helpfulCount,
    hiddenAt: l.exp.hiddenAt ? fmtDate(l.exp.hiddenAt) : undefined,
    hiddenReason: l.exp.hiddenReason ?? undefined,
  }));
  return { items, total, hasMore: offset + rows.length < total };
}

// ── Ops · user/role management (paginated + searchable) ──────────────────────
export interface OpsUserRow {
  id: string;
  name: string;
  email: string;
  batch: string;
  role: (typeof s.userRole.enumValues)[number];
}
export interface OpsUsersPage {
  users: OpsUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Admins/moderators float to the top, then alphabetical - the list is bounded
// (LIMIT/OFFSET) so it scales past a handful of rows, and `q` matches name OR
// email (case-insensitive).
const roleRank = sql`case ${s.users.role} when 'super_admin' then 0 when 'moderator' then 1 else 2 end`;

export async function listOpsUsers(opts?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<OpsUsersPage> {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 20, 1), 100);
  const page = Math.max(opts?.page ?? 1, 1);
  const q = opts?.q?.trim();
  const where = q
    ? or(ilike(s.users.name, `%${q}%`), ilike(s.users.sstEmail, `%${q}%`))
    : undefined;

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(s.users).where(where),
    db
      .select({
        id: s.users.id,
        name: s.users.name,
        email: s.users.sstEmail,
        batchYear: s.users.batchYear,
        role: s.users.role,
      })
      .from(s.users)
      .where(where)
      .orderBy(roleRank, asc(s.users.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      batch: batchOf(u.batchYear),
      role: u.role,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface RoleChangeEntry {
  id: string;
  who: string;
  fromRole: string;
  toRole: string;
  by: string;
  reason: string | null;
  when: string;
}

export async function listRecentRoleChanges(limit = 8): Promise<RoleChangeEntry[]> {
  const changed = alias(s.users, "changed_user");
  const changer = alias(s.users, "changed_by_user");
  const rows = await db
    .select({
      id: s.roleChangeAudit.id,
      who: changed.name,
      fromRole: s.roleChangeAudit.fromRole,
      toRole: s.roleChangeAudit.toRole,
      by: changer.name,
      reason: s.roleChangeAudit.reason,
      when: s.roleChangeAudit.createdAt,
    })
    .from(s.roleChangeAudit)
    .innerJoin(changed, eq(changed.id, s.roleChangeAudit.changedUserId))
    .innerJoin(changer, eq(changer.id, s.roleChangeAudit.changedByUserId))
    .orderBy(desc(s.roleChangeAudit.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    who: r.who,
    fromRole: r.fromRole,
    toRole: r.toRole,
    by: r.by,
    reason: r.reason,
    when: fmtDate(r.when),
  }));
}

// ── Edit-mode prefill: map DB rows back onto the draft shape ─────────────────
// Author-gated. The share form treats this exactly like a loaded draft.
export async function getEditPrefill(
  id: string,
  userId: string,
): Promise<{ form: ShareDraftForm; status: ReviewStatus } | null> {
  const rows = await loadWhere(
    and(eq(s.experiences.id, id), eq(s.experiences.authorId, userId)),
    desc(s.experiences.createdAt),
  );
  const l = rows[0];
  if (!l || l.exp.deletedAt) return null;
  return {
    status: statusOf(l.exp),
    form: {
      company: companyNameOf(l),
      role: l.exp.roleTitle,
      year: l.exp.year,
      outcome: l.exp.overallOutcome,
      anonymous: l.exp.isAnonymous,
      reflection: l.exp.reflectionText ?? "",
      tips: l.tips.map((t) => ({ category: t.category, text: t.text })),
      rounds: l.rounds.map((rd) => ({
        round: rd.name,
        status: rd.status,
        detailed: rd.isDetailed,
        platform: rd.platform ?? "",
        note: rd.notes ?? "",
        blocks: rd.blocks.map((b) => ({
          type: b.blockType,
          prompt: b.prompt,
          topics: b.tags,
          difficulty: b.difficulty,
          detail: b.detail ?? "",
        })),
      })),
    },
  };
}

// Invite-to-share has NO dedupe (product decision 2026-06-13): Ops invites
// students per experience, so the campaign send re-parses the CSV and emails
// every valid row - there is no "already shared / already invited" lookup.

// ── Canonical vocabularies (concern #10) ─────────────────────────────────────
// The share form SELECTs companies / round types / topic tags from the DB, so
// students can never introduce a duplicate by free-typing. Round types + topics
// are restricted to active rows; companies are the full canonical list (the
// typeahead suggests them, and an unmatched name rides along as a proposal).
export async function getShareFormOptions(): Promise<ShareFormOptions> {
  const [companies, roundTypeRows, topicRows] = await Promise.all([
    db
      .select({ name: s.companies.name, industry: s.companies.industry })
      .from(s.companies)
      .orderBy(s.companies.name),
    db
      .select({ label: s.roundTypes.label })
      .from(s.roundTypes)
      .where(eq(s.roundTypes.isActive, true))
      .orderBy(asc(s.roundTypes.position), asc(s.roundTypes.label)),
    db
      .select({ label: s.topicTags.label, category: s.topicTags.category })
      .from(s.topicTags)
      .where(eq(s.topicTags.isActive, true))
      .orderBy(asc(s.topicTags.label)),
  ]);
  return {
    companies: companies.map((c) => ({ name: c.name, industry: c.industry ?? "" })),
    roundTypes: roundTypeRows.map((r) => r.label),
    topics: topicRows.map((t) => ({ label: t.label, category: t.category })),
  };
}

// ── Ops taxonomy admin reads ─────────────────────────────────────────────────
export interface OpsCompanyRow {
  id: string;
  name: string;
  slug: string;
  industry: string;
  location: string;
  aliases: string[];
  experiences: number; // total experiences bound (any status), for merge safety
}

// Companies + a bound-experience count (any review status), name-ordered. The
// count tells Ops what a merge/rename will move. `q` matches name or alias.
export async function listOpsCompanies(q?: string): Promise<OpsCompanyRow[]> {
  const term = q?.trim();
  const where = term
    ? sql`lower(${s.companies.name}) like ${`%${term.toLowerCase()}%`}
          or exists (select 1 from unnest(${s.companies.aliases}) a
                     where lower(a) like ${`%${term.toLowerCase()}%`})`
    : undefined;
  const [companies, counts] = await Promise.all([
    db.select().from(s.companies).where(where).orderBy(asc(s.companies.name)),
    db
      .select({ companyId: s.experiences.companyId, n: count() })
      .from(s.experiences)
      .groupBy(s.experiences.companyId),
  ]);
  const byId = new Map(counts.map((r) => [r.companyId, r.n]));
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    industry: c.industry ?? "",
    location: c.location ?? "",
    aliases: c.aliases,
    experiences: byId.get(c.id) ?? 0,
  }));
}

export interface OpsRoundTypeRow {
  id: string;
  label: string;
  slug: string;
  position: number;
  isActive: boolean;
  uses: number; // rounds carrying this label (by name), for context
}

export async function listOpsRoundTypes(): Promise<OpsRoundTypeRow[]> {
  const [types, uses] = await Promise.all([
    db
      .select()
      .from(s.roundTypes)
      .orderBy(asc(s.roundTypes.position), asc(s.roundTypes.label)),
    db.select({ name: s.rounds.name, n: count() }).from(s.rounds).groupBy(s.rounds.name),
  ]);
  const byName = new Map(uses.map((r) => [r.name, r.n]));
  return types.map((t) => ({
    id: t.id,
    label: t.label,
    slug: t.slug,
    position: t.position,
    isActive: t.isActive,
    uses: byName.get(t.label) ?? 0,
  }));
}

export interface OpsTopicRow {
  id: string;
  label: string;
  slug: string;
  category: (typeof s.tagCategory.enumValues)[number];
  isDsa: boolean;
  isActive: boolean;
  uses: number; // content-block links, for context
}

export async function listOpsTopics(): Promise<OpsTopicRow[]> {
  const [topics, uses] = await Promise.all([
    db.select().from(s.topicTags).orderBy(asc(s.topicTags.label)),
    db
      .select({ tagId: s.contentBlockTopicTags.tagId, n: count() })
      .from(s.contentBlockTopicTags)
      .groupBy(s.contentBlockTopicTags.tagId),
  ]);
  const byId = new Map(uses.map((r) => [r.tagId, r.n]));
  return topics.map((t) => ({
    id: t.id,
    label: t.label,
    slug: t.slug,
    category: t.category,
    isDsa: t.isDsa,
    isActive: t.isActive,
    uses: byId.get(t.id) ?? 0,
  }));
}

// Company typeahead for the Ops review step (resolving a proposed company) -
// canonical companies matching `q` by name or alias, bounded.
export async function searchCompanies(
  q: string,
  limit = 8,
): Promise<{ id: string; name: string; industry: string }[]> {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const rows = await db
    .select({ id: s.companies.id, name: s.companies.name, industry: s.companies.industry })
    .from(s.companies)
    .where(
      sql`lower(${s.companies.name}) like ${`%${t}%`}
          or exists (select 1 from unnest(${s.companies.aliases}) a where lower(a) like ${`%${t}%`})`,
    )
    .orderBy(asc(s.companies.name))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, name: r.name, industry: r.industry ?? "" }));
}
