// Read queries. THE visibility invariant lives here once, not per-screen:
// a student-facing experience is approved AND not author-deleted AND not
// Ops-hidden. Every read path goes through `visibleExp`.
//
// Rows are mapped to the shared DTO shapes (lib/types.ts) so the client
// views stay unchanged.
import { and, asc, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
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

async function loadWhere(where: SQL | undefined, orderBy: SQL): Promise<Loaded[]> {
  const exps = await db
    .select()
    .from(s.experiences)
    .innerJoin(s.companies, eq(s.experiences.companyId, s.companies.id))
    .innerJoin(s.users, eq(s.experiences.authorId, s.users.id))
    .where(where)
    .orderBy(orderBy);
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
export async function getSavedExperiences(userId: string): Promise<Experience[]> {
  const saved = await db
    .select({ experienceId: s.savedExperiences.experienceId })
    .from(s.savedExperiences)
    .where(eq(s.savedExperiences.userId, userId))
    .orderBy(desc(s.savedExperiences.createdAt));
  if (saved.length === 0) return [];
  const order = new Map(saved.map((r, i) => [r.experienceId, i]));
  const rows = await loadWhere(
    and(visibleExp, inArray(s.experiences.id, saved.map((r) => r.experienceId))),
    desc(s.experiences.publishedAt),
  );
  return rows
    .sort((a, b) => (order.get(a.exp.id) ?? 0) - (order.get(b.exp.id) ?? 0))
    .map(toCard);
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
      company: l.company.name,
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

// The author's newest live submission awaiting review — the /under-review page
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
    companyName: l.company.name,
    companyIndustry: l.company.industry ?? "",
    submittedAgo: agoOf(l.exp.createdAt),
  };
}

// ── Ops reads ────────────────────────────────────────────────────────────────
// FIFO is the product promise (PRD §10): oldest created_at first, no
// fast-tracking. Resubmissions re-stamp created_at, which is what sends them
// to the back of this very ordering.
export async function getOpsQueue(): Promise<OpsQueueItem[]> {
  const pending = await loadWhere(
    and(
      eq(s.experiences.reviewStatus, "under_review"),
      isNull(s.experiences.withdrawnAt),
      isNull(s.experiences.deletedAt),
    ),
    asc(s.experiences.createdAt),
  );
  return pending.map((l) => ({
    id: l.exp.id,
    realAuthor: {
      name: l.author.name,
      batch: batchOf(l.author.batchYear),
      email: l.author.sstEmail,
    },
    bylineAs: l.exp.isAnonymous ? "anonymous" : "real",
    company: l.company.name,
    role: l.exp.roleTitle,
    round: l.rounds[0]?.name ?? "—",
    outcome: l.exp.overallOutcome,
    submittedAgo: agoOf(l.exp.createdAt),
    questions: l.rounds.reduce((n, r) => n + r.blocks.length, 0),
    tips: l.tips.length,
    hasReflection: Boolean(l.exp.reflectionText?.trim()),
    overview: l.exp.overview ?? "",
    detail: toDetail(l),
  }));
}

// Published view for Ops: approved & not author-deleted — hidden posts stay
// listed (flagged) so they can be unhidden.
export async function listOpsPublished(): Promise<OpsPublishedItem[]> {
  const rows = await loadWhere(
    and(eq(s.experiences.reviewStatus, "approved"), isNull(s.experiences.deletedAt)),
    desc(s.experiences.publishedAt),
  );
  return rows.map((l) => ({
    id: l.exp.id,
    company: l.company.name,
    role: l.exp.roleTitle,
    round: l.rounds[0]?.name ?? "—",
    outcome: l.exp.overallOutcome,
    publishedAt: fmtDate(l.exp.publishedAt),
    views: l.exp.viewCount,
    helpful: l.exp.helpfulCount,
    hiddenAt: l.exp.hiddenAt ? fmtDate(l.exp.hiddenAt) : undefined,
    hiddenReason: l.exp.hiddenReason ?? undefined,
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
      company: l.company.name,
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

// ── Invite-to-share dedupe sets (PRD §7 Flow F) ──────────────────────────────
// Lowercased emails the next campaign must skip: students with a post already
// on the platform (any non-deleted, non-withdrawn submission counts — drafts
// in review included) and students a previous campaign already emailed.
export async function getInviteDedupe(): Promise<{
  alreadyShared: string[];
  alreadyInvited: string[];
}> {
  const [authors, invited] = await Promise.all([
    db
      .selectDistinct({ email: s.users.sstEmail })
      .from(s.users)
      .innerJoin(s.experiences, eq(s.experiences.authorId, s.users.id))
      .where(and(isNull(s.experiences.deletedAt), isNull(s.experiences.withdrawnAt))),
    db
      .selectDistinct({ email: s.inviteRecipients.email })
      .from(s.inviteRecipients)
      .where(eq(s.inviteRecipients.status, "sent")),
  ]);
  return {
    alreadyShared: authors.map((r) => r.email.toLowerCase()),
    alreadyInvited: invited.map((r) => r.email.toLowerCase()),
  };
}
