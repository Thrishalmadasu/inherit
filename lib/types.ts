// Shared DTO types - the card/detail shapes the UI consumes.
// Born in lib/mock/data.ts (Phase 0); promoted here per handbook §6 so the
// types outlive the mock values. lib/db/queries.ts maps DB rows onto these;
// client views consume them. Shapes are intentionally loose (single- vs
// multi-round experiences) to match the prototype exactly.

export type Outcome =
  | "Offer"
  | "Shortlisted"
  | "Awaiting"
  | "Rejected"
  | "Withdrew";
export type RoundStatus = "Passed" | "Failed" | "Awaiting";
export type ReviewStatus =
  | "Under Review"
  | "Approved"
  | "Needs Edits"
  | "Rejected"
  | "Withdrawn"
  | "Hidden"
  | "Deleted";
export type TipCategory = "resource" | "strategy" | "mindset";

export interface CompanyListItem {
  slug: string;
  name: string;
  industry: string;
  count: number;
  active: boolean;
  lastDays: number;
}

export interface Author {
  name: string | null;
  batch: string;
  anonymous: boolean;
}

export interface RoundEntry {
  round: string;
  status: RoundStatus;
  questions: number;
  avgDifficulty?: number;
  platform?: string;
}

export interface QuestionDetail {
  n: number;
  topic: string;
  difficulty: number;
  platform: string;
  time: string;
  summary: string;
  approach: string;
}

export interface PrepTip {
  category: TipCategory;
  text: string;
}

export interface Experience {
  id: string;
  author: Author;
  role: string;
  year: number;
  submittedAt: string;
  helpful?: number;
  views?: number;
  excerpt?: string;
  // single-round shape
  round?: string;
  outcome?: Outcome;
  questions?: number;
  avgDifficulty?: number;
  platform?: string;
  duration?: string;
  reviewedAt?: string;
  // multi-round shape
  rounds?: RoundEntry[];
  overallOutcome?: Outcome;
  // detail page
  overview?: string;
  questionsList?: QuestionDetail[];
  prepTips?: PrepTip[];
  reflection?: string;
  topics?: string[];
  company?: string;
}

export interface RoleCount {
  name: string;
  count: number;
}
export interface TopicCount {
  name: string;
  count: number;
}
export interface RoleAggregate {
  commonPath: string[];
  pathFunnel: number[];
  topTopics: TopicCount[];
}
export interface CompanyDetail {
  slug: string;
  name: string;
  industry: string;
  location: string;
  activelyRecruiting: boolean;
  totalExperiences: number;
  breakdown: Record<string, number>;
  years: number[];
  avgDifficulty: number;
  roles: RoleCount[];
  byRole: Record<string, RoleAggregate>;
  commonPath: string[];
  pathFunnel: number[];
  topTopics: TopicCount[];
}

export interface MyPost {
  id: string;
  company: string;
  role: string;
  overallOutcome: Outcome;
  status: ReviewStatus;
  submittedAt: string;
  updatedAt?: string;
  deletedAt?: string;
  tips: number;
  views?: number;
  helpful?: number;
  opsNote?: string;
  hiddenReason?: string;
  hiddenAt?: string;
  rounds: RoundEntry[];
}

export interface OpsQueueItem {
  id: string;
  realAuthor: { name: string; batch: string; email: string };
  bylineAs: "real" | "anonymous";
  company: string;
  // Set only when the named company isn't canonical yet - the moderator must
  // resolve it (map to existing / promote) before this post can be approved.
  proposedCompany?: string | null;
  role: string;
  // Set only when the role isn't canonical yet - resolved at review like company.
  proposedRole?: string | null;
  round: string;
  outcome: Outcome;
  submittedAgo: string;
  questions: number;
  tips: number;
  hasReflection: boolean;
  overview: string;
  detail: Experience; // full post for inline review (moderators approve what they read)
}

export interface OpsPublishedItem {
  id: string;
  company: string;
  role: string;
  round: string;
  outcome: Outcome;
  publishedAt: string;
  views: number;
  helpful: number;
  hiddenAt?: string;
  hiddenReason?: string;
}

// Map a final outcome onto the per-round status vocabulary.
export function outcomeToStatus(outcome?: Outcome): RoundStatus {
  if (outcome === "Rejected" || outcome === "Withdrew") return "Failed";
  if (outcome === "Awaiting") return "Awaiting";
  return "Passed";
}

// Resolve a card-level avgDifficulty whether single- or multi-round.
export function avgDifficultyOf(e: Experience): number {
  if (e.rounds && e.rounds.length) {
    const diffs = e.rounds
      .map((r) => r.avgDifficulty)
      .filter((d): d is number => typeof d === "number");
    return diffs.length ? diffs.reduce((s, d) => s + d, 0) / diffs.length : 0;
  }
  return e.avgDifficulty || 0;
}
