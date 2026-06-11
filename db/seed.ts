// Seed: users, companies, the curated topic taxonomy, and the demo experiences
// (mock questions split into typed content blocks). Run: npx tsx db/seed.ts
// Wipes and re-seeds — dev-only by design.
process.loadEnvFile(".env.local");

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray, sql } from "drizzle-orm";
import * as s from "../lib/db/schema";
import { TOPIC_TAXONOMY } from "../lib/share-form";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema: s });

const slugify = (x: string) =>
  x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ── Static seed data ─────────────────────────────────────────────────────────
const USERS = [
  { name: "Thrishal M.", sstEmail: "thrishal.23bcs10115@sst.scaler.com", role: "super_admin" as const },
  { name: "Riya K.", sstEmail: "riya.23bcs10043@sst.scaler.com", role: "moderator" as const },
  { name: "Aarav S.", sstEmail: "aarav.23bcs10084@sst.scaler.com", role: "student" as const },
  { name: "Nikhil D.", sstEmail: "nikhil.23bcs10071@sst.scaler.com", role: "student" as const },
  { name: "Priya R.", sstEmail: "priya.23bcs10112@sst.scaler.com", role: "student" as const },
];

const COMPANIES = [
  { name: "Amazon", industry: "E-commerce · Cloud", location: "Bengaluru, IN" },
  { name: "Microsoft", industry: "Cloud · Productivity", location: "Hyderabad, IN" },
  { name: "Google", industry: "Search · Cloud", location: "Bengaluru, IN" },
  { name: "Atlassian", industry: "Developer tools", location: "Bengaluru, IN" },
  { name: "Razorpay", industry: "Fintech", location: "Bengaluru, IN" },
  { name: "Sprinklr", industry: "CX SaaS", location: "Gurugram, IN" },
  { name: "Zomato", industry: "Consumer · Logistics", location: "Gurugram, IN" },
  { name: "Walmart Global Tech", industry: "Retail · E-commerce", location: "Bengaluru, IN" },
];

type BlockSeed = {
  type: "coding" | "system_design" | "behavioral" | "open";
  prompt: string;
  tags: string[];
  difficulty?: number;
  detail?: string;
};
type RoundSeed = {
  name: string;
  status: "Passed" | "Failed" | "Awaiting";
  platform?: string;
  notes?: string;
  blocks?: BlockSeed[];
};
type ExpSeed = {
  id: string;
  author: string; // user name
  company: string;
  role: string;
  year: number;
  outcome: "Offer" | "Shortlisted" | "Awaiting" | "Rejected" | "Withdrew";
  anonymous?: boolean;
  publishedAt: string;
  helpful: number;
  views: number;
  durationMinutes?: number;
  overview?: string;
  reflection?: string;
  imported?: boolean;
  rounds: RoundSeed[];
  tips?: { category: "resource" | "strategy" | "mindset"; text: string }[];
};

const EXPERIENCES: ExpSeed[] = [
  {
    id: "exp-021",
    author: "Riya K.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Offer",
    publishedAt: "May 04, 2026",
    helpful: 64,
    views: 980,
    overview:
      "Full pipeline writeup: OA, two technical rounds, one behavioural, HR. Sharing the question themes and the LP stories I leaned on — happy to chat 1:1.",
    rounds: [
      {
        name: "OA",
        status: "Passed",
        platform: "HackerRank",
        notes: "110 min — two coding + aptitude",
        blocks: [
          { type: "coding", prompt: "Sub-array sums over a threshold with a fixed window.", tags: ["Arrays & Strings", "Sliding Window"], difficulty: 3 },
          { type: "coding", prompt: "Frequency-map pairing question on transaction logs.", tags: ["Hash Maps"], difficulty: 3 },
          { type: "open", prompt: "Quant aptitude — ratios, probability, time-and-work.", tags: ["Aptitude"] },
        ],
      },
      {
        name: "Tech 1",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [
          { type: "coding", prompt: "Lowest common ancestor variant with parent pointers.", tags: ["Trees"], difficulty: 4 },
          { type: "behavioral", prompt: "Tell me about a time you took ownership beyond your role.", tags: ["Leadership Principles", "Ownership"], detail: "Two follow-ups deep; STAR format expected." },
        ],
      },
      {
        name: "Tech 2",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [
          { type: "coding", prompt: "Shortest path with blocked cells and one allowed wall-break.", tags: ["Graphs (BFS/DFS)"], difficulty: 4 },
          { type: "coding", prompt: "Design a parking-lot class hierarchy, then extend for EV charging.", tags: ["OOP Design"], difficulty: 4 },
        ],
      },
      {
        name: "Behavioral",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [
          { type: "behavioral", prompt: "A time you disagreed with your manager and how you resolved it.", tags: ["Leadership Principles", "Conflict Resolution"] },
        ],
      },
      {
        name: "HR",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [{ type: "open", prompt: "Compensation expectations, relocation, joining timeline.", tags: ["Compensation", "Role Fit"] }],
      },
    ],
    tips: [
      { category: "strategy", text: "Keep 8 STAR stories ready — every behavioural follow-up mapped back to one of them." },
      { category: "mindset", text: "The bar-raiser round feels adversarial by design. It's a stress test, not a verdict." },
    ],
  },
  {
    id: "exp-019",
    author: "Thrishal M.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Shortlisted",
    publishedAt: "Apr 28, 2026",
    helpful: 42,
    views: 612,
    durationMinutes: 110,
    overview:
      "Standard Amazon SDE-Intern Online Assessment hosted on HackerRank. The window was 110 minutes - 90 for two coding questions and ~20 for a short aptitude/work-style section. Camera on, tab-switch detection enabled, no copy-paste from outside the editor. The coding section was language-agnostic; I used C++17. Both questions had partial credit (~10 sample test-cases visible, 30 hidden).",
    reflection:
      "The OA itself isn't unreasonable - what makes it stressful is the proctoring environment, not the problems. Practise on a timer at HackerRank, not just on LeetCode in a comfortable IDE. The thing nobody told me: read all four questions in the first 90 seconds before you start typing. I almost spent 40 minutes on Q1 when Q2 was actually closer to my strengths.\n\nAlso - don't bother with esoteric language features. I switched to C++ from Python the day before because I was paranoid about TLE on the sliding-window problem. Plain idiomatic code in any language is fine; the test-cases aren't designed to punish constants.",
    rounds: [
      {
        name: "OA",
        status: "Passed",
        platform: "HackerRank",
        notes: "110 min — 90 coding + 20 aptitude/work-style",
        blocks: [
          {
            type: "coding",
            prompt:
              "Given an array of N integers and a window size K, return the count of distinct sub-arrays of length K whose sum is strictly greater than a given threshold T. Constraints: N ≤ 2·10⁵, values up to 10⁹.",
            tags: ["Arrays & Strings", "Sliding Window"],
            difficulty: 3,
            detail:
              "Classic prefix-sum + hashing on the window-tuple. Brute-force is O(N·K) and TLE'd on 3 cases for me - moving to a rolling hash plus a HashSet to dedupe the windows by content cleared it.",
          },
          {
            type: "coding",
            prompt:
              "M×N grid with cells marked 0/1/2. Starting from every '2' cell simultaneously, find the minimum time for all '1' cells to become '2' (with standard 4-directional spread). Return -1 if impossible.",
            tags: ["Graphs (BFS/DFS)"],
            difficulty: 4,
            detail:
              "Multi-source BFS. Seed the queue with every '2' cell up front and track total steps. The trap is forgetting to verify all '1' cells were actually reached before returning - easy to off-by-one if you increment time at the wrong point.",
          },
          {
            type: "open",
            prompt:
              "8 multiple-choice questions on probability, ratios, and basic time-and-work. No negative marking. Pacing is the only real challenge - < 90s per question.",
            tags: ["Aptitude"],
            detail: "Skip the long-reading ones first, then come back. I left 1 unattempted and still cleared.",
          },
          {
            type: "behavioral",
            prompt:
              'Likert-scale statements ("I prefer working on a small team where everyone owns a clear scope", etc). ~25 statements.',
            tags: ["Work Style"],
            detail:
              "Be consistent - duplicate statements appear phrased in opposite directions. Don't try to game it; the inconsistency itself is a signal.",
          },
        ],
      },
      { name: "Tech 1", status: "Awaiting" },
    ],
    tips: [
      { category: "resource", text: "The NeetCode 150 list covers ~90% of Amazon OA patterns. Focus on the Arrays, Sliding Window, and BFS sections in particular." },
      { category: "strategy", text: "Solve one question fully before moving to the second - Amazon weights a fully-solved easier question higher than two half-solved hard ones, in my experience and from talking to recruiters." },
      { category: "strategy", text: "Type out brute-force code first to lock in the I/O, then optimise. Saves 5 minutes when you realise the optimal approach mid-way." },
      { category: "mindset", text: "If you blank for >2 minutes on a question, switch. The aptitude section is fast to clear and will steady your nerves before you come back." },
      { category: "resource", text: "Recent Amazon OA archive on the SST drive (last 4 cycles) - patterns repeat about 30% of the time." },
    ],
  },
  {
    id: "exp-017",
    author: "Aarav S.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Offer",
    anonymous: true,
    publishedAt: "Apr 22, 2026",
    helpful: 28,
    views: 489,
    overview:
      "45-min interview. One DSA question (medium-hard, trees), one OOP design question (parking lot scaled down), and 10 minutes of Leadership Principles questions tied back to my resume projects.",
    rounds: [
      {
        name: "Tech 1",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [
          { type: "coding", prompt: "Serialize/deserialize a binary tree with parent links.", tags: ["Trees"], difficulty: 4 },
          { type: "coding", prompt: "Parking lot OOP design, scaled down to 20 minutes.", tags: ["OOP Design"], difficulty: 4 },
          { type: "behavioral", prompt: "LP questions tied to my resume projects.", tags: ["Leadership Principles"] },
        ],
      },
    ],
  },
  {
    id: "exp-016",
    author: "Aarav S.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Rejected",
    publishedAt: "Apr 14, 2026",
    helpful: 16,
    views: 312,
    overview:
      "Both questions were on the harder side - DP on intervals and a string-matching problem. I solved one fully and got partial credit on the second. Didn't make the cut.",
    rounds: [
      {
        name: "OA",
        status: "Failed",
        platform: "HackerRank",
        blocks: [
          { type: "coding", prompt: "Interval DP — maximum score from merging adjacent intervals.", tags: ["Dynamic Programming"], difficulty: 4 },
          { type: "coding", prompt: "String matching with at most one wildcard substitution.", tags: ["Arrays & Strings"], difficulty: 4 },
        ],
      },
    ],
  },
  {
    id: "exp-014",
    author: "Riya K.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Offer",
    publishedAt: "Apr 09, 2026",
    helpful: 31,
    views: 511,
    overview:
      "Pure Leadership Principles round. Bar-raiser interviewer. Five behavioural prompts, each going 2-3 follow-ups deep. STAR format is non-negotiable; have at least 8 stories prepared.",
    rounds: [
      {
        name: "Behavioral",
        status: "Passed",
        platform: "Amazon Chime",
        blocks: [
          { type: "behavioral", prompt: "Five LP prompts, each 2-3 follow-ups deep.", tags: ["Leadership Principles"], detail: "Bar-raiser style. STAR non-negotiable." },
          { type: "behavioral", prompt: "A failure you owned end-to-end.", tags: ["Failure Story", "Ownership"] },
        ],
      },
    ],
  },
  {
    id: "exp-011",
    author: "Nikhil D.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2026,
    outcome: "Awaiting",
    anonymous: true,
    publishedAt: "Apr 02, 2026",
    helpful: 11,
    views: 245,
    overview:
      "Senior engineer on the call. One brutal graph question with optimisation follow-ups, then a 15-min discussion on trade-offs between BFS and Dijkstra for the same problem at different scales.",
    rounds: [
      {
        name: "Tech 2",
        status: "Awaiting",
        platform: "Amazon Chime",
        blocks: [
          { type: "coding", prompt: "Weighted shortest path with optimisation follow-ups; BFS vs Dijkstra trade-offs at scale.", tags: ["Graphs (BFS/DFS)"], difficulty: 5 },
        ],
      },
    ],
  },
  {
    id: "exp-008",
    author: "Nikhil D.",
    company: "Amazon",
    role: "SDE Intern",
    year: 2025,
    outcome: "Shortlisted",
    publishedAt: "Oct 18, 2025",
    helpful: 14,
    views: 220,
    imported: true,
    overview:
      "OA pattern from the 2025 cycle. Three questions - one easy, one medium (heaps), one hard (DP). Took the full 90 minutes; cleared with 2 fully solved.",
    rounds: [
      {
        name: "OA",
        status: "Passed",
        platform: "HackerRank",
        blocks: [
          { type: "coding", prompt: "K most frequent elements under a streaming constraint.", tags: ["Heap"], difficulty: 3 },
          { type: "coding", prompt: "Hard DP on subsequences with a parity constraint.", tags: ["Dynamic Programming"], difficulty: 4 },
        ],
      },
    ],
  },
];

async function main() {
  console.log("Wiping…");
  // FK-safe order
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
  await db.delete(s.contentBlockTopicTags);
  await db.delete(s.topicTags);
  await db.delete(s.companies);
  await db.delete(s.users);

  console.log("Users…");
  const userRows = await db
    .insert(s.users)
    .values(USERS.map((u) => ({ ...u, batchYear: 2027 })))
    .returning();
  const userId = new Map(userRows.map((u) => [u.name, u.id]));

  console.log("Companies…");
  const companyRows = await db
    .insert(s.companies)
    .values(COMPANIES.map((c) => ({ ...c, slug: slugify(c.name === "Walmart Global Tech" ? "walmart-tech" : c.name) })))
    .returning();
  const companyId = new Map(companyRows.map((c) => [c.name, c.id]));

  console.log("Topic taxonomy…");
  const tagRows = await db
    .insert(s.topicTags)
    .values(
      TOPIC_TAXONOMY.map((t) => ({
        label: t.label,
        slug: slugify(t.label),
        category: t.category as (typeof s.tagCategory.enumValues)[number],
        isDsa: t.category === "dsa",
      })),
    )
    .returning();
  const tagId = new Map(tagRows.map((t) => [t.label, t.id]));

  console.log("Experiences…");
  for (const e of EXPERIENCES) {
    const published = new Date(e.publishedAt);
    await db.insert(s.experiences).values({
      id: e.id,
      authorId: userId.get(e.author)!,
      companyId: companyId.get(e.company)!,
      roleTitle: e.role,
      year: e.year,
      overallOutcome: e.outcome,
      isAnonymous: e.anonymous ?? false,
      overview: e.overview,
      reflectionText: e.reflection,
      reviewStatus: "approved",
      reviewedBy: userId.get("Riya K.")!,
      reviewedAt: published,
      helpfulCount: e.helpful,
      viewCount: e.views,
      durationMinutes: e.durationMinutes,
      importedFromArchive: e.imported ?? false,
      createdAt: published,
      updatedAt: published,
      publishedAt: published,
    });

    for (const [ri, r] of e.rounds.entries()) {
      const [round] = await db
        .insert(s.rounds)
        .values({
          experienceId: e.id,
          position: ri,
          name: r.name,
          status: r.status,
          isDetailed: (r.blocks?.length ?? 0) > 0,
          platform: r.platform,
          notes: r.notes,
        })
        .returning();

      for (const [bi, b] of (r.blocks ?? []).entries()) {
        const [block] = await db
          .insert(s.contentBlocks)
          .values({
            roundId: round.id,
            position: bi,
            blockType: b.type,
            prompt: b.prompt,
            difficulty: b.difficulty ?? null,
            detail: b.detail,
          })
          .returning();
        const links = b.tags
          .map((label) => tagId.get(label))
          .filter((x): x is string => !!x)
          .map((tid) => ({ blockId: block.id, tagId: tid }));
        if (links.length) await db.insert(s.contentBlockTopicTags).values(links);
      }
    }

    if (e.tips?.length) {
      await db.insert(s.prepTips).values(
        e.tips.map((t, i) => ({ experienceId: e.id, position: i, ...t })),
      );
    }
  }

  // sanity counts
  const [{ count: expCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.experiences);
  const [{ count: blockCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.contentBlocks);
  const [{ count: tagCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.topicTags);
  console.log(`Done: ${expCount} experiences, ${blockCount} blocks, ${tagCount} tags.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
