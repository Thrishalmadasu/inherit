// Share-form domain: curated topic taxonomy, pipeline constants, the empty-
// form factory, and the completion-% formula. UI-free so it can be unit-tested
// and reused by the server actions later.
import type {
  DraftBlock,
  DraftBlockType,
  DraftRound,
  ShareDraftForm,
} from "@/lib/draft";

// Companies and round types are now sourced from the canonical DB tables
// (concern #10), passed into the share form as props — there is no static
// company/round list to drift. `ShareFormOptions` is the server→form contract.
export interface ShareFormOptions {
  companies: { name: string; industry: string }[];
  roundTypes: string[];
  topics: { label: string; category: string }[];
}

export const ROLE_SUGGESTIONS = [
  { name: "SDE Intern", hint: "Software" },
  { name: "SDE-1", hint: "Software" },
  { name: "SDE-2", hint: "Software" },
  { name: "Backend Intern", hint: "Software" },
  { name: "Frontend Intern", hint: "Software" },
  { name: "Data Analyst", hint: "Data" },
  { name: "Data Scientist", hint: "Data" },
  { name: "ML Intern", hint: "Data" },
  { name: "PM Intern", hint: "Product" },
  { name: "DevOps Intern", hint: "Infra" },
];

export const YEARS = [2026, 2025, 2024, 2023];

export const OUTCOMES = ["Offer", "Shortlisted", "Awaiting", "Rejected", "Withdrew"] as const;

// Canonical pipeline-round vocabulary seeded into the `round_types` table.
// Order = display order in the share-form dropdown. Ops can add/rename more
// in-app (mirror topics); students only ever SELECT from the DB list.
export const ROUND_TYPE_SEED = [
  "OA",
  "Aptitude",
  "Group Discussion",
  "Tech 1",
  "Tech 2",
  "System Design",
  "Hiring Manager",
  "Behavioral",
  "Bar Raiser",
  "HR",
] as const;

export const ROUND_STATUSES = ["Passed", "Failed", "Awaiting"] as const;

// ── Curated topic taxonomy (per PRD: students pick ONLY from this list; the
// real list becomes the topic_tags table in Phase 1) ─────────────────────────
export const TOPIC_TAXONOMY: { label: string; category: string }[] = [
  // DSA
  { label: "Arrays & Strings", category: "dsa" },
  { label: "Sliding Window", category: "dsa" },
  { label: "Two Pointers", category: "dsa" },
  { label: "Hash Maps", category: "dsa" },
  { label: "Binary Search", category: "dsa" },
  { label: "Stacks & Queues", category: "dsa" },
  { label: "Trees", category: "dsa" },
  { label: "Graphs (BFS/DFS)", category: "dsa" },
  { label: "Dynamic Programming", category: "dsa" },
  { label: "Recursion", category: "dsa" },
  { label: "Heap", category: "dsa" },
  { label: "Sorting", category: "dsa" },
  { label: "Concurrency", category: "dsa" },
  { label: "OOP Design", category: "dsa" },
  // System design
  { label: "API Design", category: "system_design" },
  { label: "Caching", category: "system_design" },
  { label: "Scalability", category: "system_design" },
  { label: "Database Choice", category: "system_design" },
  { label: "Rate Limiting", category: "system_design" },
  { label: "Distributed Systems", category: "system_design" },
  // Behavioral
  { label: "Leadership Principles", category: "behavioral" },
  { label: "Ownership", category: "behavioral" },
  { label: "Customer Obsession", category: "behavioral" },
  { label: "Bias for Action", category: "behavioral" },
  { label: "Conflict Resolution", category: "behavioral" },
  { label: "Failure Story", category: "behavioral" },
  { label: "Teamwork", category: "behavioral" },
  // Domain / other
  { label: "SQL", category: "domain" },
  { label: "Statistics", category: "domain" },
  { label: "Case Study", category: "domain" },
  { label: "Aptitude", category: "other" },
  { label: "Work Style", category: "other" },
  { label: "Compensation", category: "other" },
  { label: "Role Fit", category: "other" },
];

// Per-block-type suggested tags shown as one-click chips.
export const BLOCK_TAG_SUGGESTIONS: Record<DraftBlockType, string[]> = {
  coding: [
    "Arrays & Strings",
    "Sliding Window",
    "Graphs (BFS/DFS)",
    "Dynamic Programming",
    "Trees",
    "Binary Search",
    "Hash Maps",
  ],
  system_design: [
    "API Design",
    "Caching",
    "Scalability",
    "Database Choice",
    "Rate Limiting",
    "Distributed Systems",
  ],
  behavioral: [
    "Leadership Principles",
    "Ownership",
    "Conflict Resolution",
    "Failure Story",
    "Teamwork",
  ],
  open: ["Aptitude", "Work Style", "SQL", "Case Study", "Compensation"],
};

export const BLOCK_TYPE_META: Record<
  DraftBlockType,
  { label: string; promptLabel: string; promptPlaceholder: string; detailLabel: string | null; detailPlaceholder: string; hasDifficulty: boolean }
> = {
  coding: {
    label: "Coding / DSA",
    promptLabel: "Question paraphrase",
    promptPlaceholder:
      "e.g. Count distinct sub-arrays of length K with sum greater than T…",
    detailLabel: "Your approach (optional)",
    detailPlaceholder: "How you solved it, what TLE'd, the trick that worked…",
    hasDifficulty: true,
  },
  system_design: {
    label: "System design",
    promptLabel: "Scenario / prompt",
    promptPlaceholder: "e.g. Design a rate limiter for a public API…",
    detailLabel: "Considerations / notes (optional)",
    detailPlaceholder: "What they probed on — trade-offs, scale numbers, follow-ups…",
    hasDifficulty: true,
  },
  behavioral: {
    label: "Behavioral / HR",
    promptLabel: "Question / prompt",
    promptPlaceholder: "e.g. Tell me about a time you disagreed with a teammate…",
    detailLabel: "What they looked for / your approach (optional)",
    detailPlaceholder: "STAR structure, the competency being probed, follow-up depth…",
    hasDifficulty: false,
  },
  open: {
    label: "Open",
    promptLabel: "Question",
    promptPlaceholder: "Anything that doesn't fit the other buckets…",
    detailLabel: "Notes (optional)",
    detailPlaceholder: "Extra context…",
    hasDifficulty: false,
  },
};

export function emptyBlock(type: DraftBlockType): DraftBlock {
  return {
    type,
    prompt: "",
    topics: [],
    difficulty: BLOCK_TYPE_META[type].hasDifficulty ? 3 : null,
    detail: "",
  };
}

export function emptyRound(round = "OA"): DraftRound {
  return { round, status: "Passed", detailed: false, platform: "", note: "", blocks: [] };
}

export function emptyForm(prefill?: Partial<ShareDraftForm>): ShareDraftForm {
  return {
    company: "",
    role: "",
    year: 2026,
    outcome: "",
    rounds: [emptyRound()],
    tips: [{ category: "resource", text: "" }],
    reflection: "",
    anonymous: false,
    ...prefill,
  };
}

export const STEPS = ["Basics", "Your rounds", "Prep tips", "Reflections", "Identity & submit"] as const;

// Completion %, adapted from the prototype's formula to the block model:
// basics 15, rounds ≤30, detailed rounds ≤15, tagged blocks ≤15, tips ≤12,
// reflection 8 → ~95 max before submit.
export function completionPct(f: ShareDraftForm): number {
  let pct = 0;
  if (f.company.trim()) pct += 5;
  if (f.role.trim()) pct += 5;
  if (f.outcome) pct += 5;
  pct += Math.min(f.rounds.length, 5) * 6;
  pct += Math.min(f.rounds.filter((r) => r.detailed).length, 3) * 5;
  const taggedBlocks = f.rounds.flatMap((r) => r.blocks).filter((b) => b.topics.length > 0).length;
  pct += Math.min(taggedBlocks, 5) * 3;
  pct += Math.min(f.tips.filter((t) => t.text.trim()).length, 3) * 4;
  if (f.reflection.trim()) pct += 8;
  return Math.min(pct, 95);
}

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
