// Inherit — Drizzle schema (PRD §9). The data model is the legacy: invariants
// live here, enforced by Postgres, not by per-screen convention.
//
// Conventions:
// - uuid PKs except `experiences.id` (text): seeded ids like "exp-019" keep
//   deep links stable; app-generated ids (nanoid) for new submissions.
// - Helpful-only reactions (one row per user+experience; no `type` column).
// - Author soft-delete (deleted_*) and Ops hide (hidden_*) are SEPARATE so
//   accountability is never ambiguous.
// - rounds.name is the pipeline LABEL ("OA", "Tech 1", custom names allowed).
//   It does not constrain which block types a round may contain.
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────
export const userRole = pgEnum("user_role", ["student", "moderator", "super_admin"]);
export const overallOutcome = pgEnum("overall_outcome", [
  "Offer",
  "Shortlisted",
  "Awaiting",
  "Rejected",
  "Withdrew",
]);
export const reviewStatus = pgEnum("review_status", [
  "under_review",
  "approved",
  "needs_edits",
  "rejected",
]);
export const roundStatus = pgEnum("round_status", ["Passed", "Failed", "Awaiting"]);
export const blockType = pgEnum("block_type", [
  "coding",
  "system_design",
  "behavioral",
  "open",
]);
export const tagCategory = pgEnum("tag_category", [
  "dsa",
  "system_design",
  "behavioral",
  "tooling",
  "domain",
  "other",
]);
export const tipCategory = pgEnum("tip_category", ["resource", "strategy", "mindset"]);
export const notificationType = pgEnum("notification_type", [
  "post_under_review",
  "post_live",
  "post_needs_edits",
  "post_rejected",
  "post_hidden",
]);
export const moderationActionType = pgEnum("moderation_action_type", ["hide", "unhide"]);
export const inviteRecipientStatus = pgEnum("invite_recipient_status", [
  "ready",
  "skipped",
  "sent",
  "failed",
]);
export const inviteSkipReason = pgEnum("invite_skip_reason", [
  "duplicate_in_file",
  "already_shared",
  "invalid_email",
  "missing_email",
]);

// ── Core tables ──────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  sstEmail: text("sst_email").notNull().unique(),
  name: text("name").notNull(),
  batchYear: integer("batch_year"),
  role: userRole("role").notNull().default("student"),
  displayHandle: text("display_handle"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  location: text("location"),
  aliases: text("aliases").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const experiences = pgTable("experiences", {
  id: text("id").primaryKey(), // seeded "exp-019"-style; nanoid for new rows
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  roleTitle: text("role_title").notNull(),
  year: integer("year").notNull(),
  overallOutcome: overallOutcome("overall_outcome").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  overview: text("overview"), // detail-page "Overview" lead (design §17.5)
  reflectionText: text("reflection_text"),
  reviewStatus: reviewStatus("review_status").notNull().default("under_review"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  helpfulCount: integer("helpful_count").notNull().default(0), // cached from reactions
  viewCount: integer("view_count").notNull().default(0), // total detail-page opens (server-side)
  durationMinutes: integer("duration_minutes"),
  importedFromArchive: boolean("imported_from_archive").notNull().default(false),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  // author soft-delete — never hard-deleted
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => users.id),
  // Ops hide of a LIVE post — reason REQUIRED at the action layer
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  hiddenBy: uuid("hidden_by").references(() => users.id),
  hiddenReason: text("hidden_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  experienceId: text("experience_id")
    .notNull()
    .references(() => experiences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  name: text("name").notNull(), // pipeline label: "OA", "Tech 1", "SQL Round"…
  status: roundStatus("status").notNull(),
  isDetailed: boolean("is_detailed").notNull().default(false),
  platform: text("platform"),
  notes: text("notes"),
});

export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  blockType: blockType("block_type").notNull(),
  prompt: text("prompt").notNull(),
  difficulty: integer("difficulty"), // 1–5; NULL for behavioral/open
  detail: text("detail"),
});

export const topicTags = pgTable("topic_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  slug: text("slug").notNull().unique(),
  category: tagCategory("category").notNull(),
  isDsa: boolean("is_dsa").notNull().default(false), // powers the L&D DSA split
  aliases: text("aliases").array().notNull().default([]),
  createdBy: uuid("created_by").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
});

export const contentBlockTopicTags = pgTable(
  "content_block_topic_tags",
  {
    blockId: uuid("block_id")
      .notNull()
      .references(() => contentBlocks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => topicTags.id),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.tagId] })],
);

export const prepTips = pgTable("prep_tips", {
  id: uuid("id").primaryKey().defaultRandom(),
  experienceId: text("experience_id")
    .notNull()
    .references(() => experiences.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  text: text("text").notNull(),
  category: tipCategory("category").notNull(),
});

// Helpful-only like — UNIQUE(user, experience) is the one-vote invariant.
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    experienceId: text("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reactions_user_experience_uq").on(t.userId, t.experienceId)],
);

export const savedExperiences = pgTable(
  "saved_experiences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    experienceId: text("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.experienceId] })],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: notificationType("type").notNull(),
  experienceId: text("experience_id").references(() => experiences.id),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

// ── Audit tables (append-only) ───────────────────────────────────────────────
export const roleChangeAudit = pgTable("role_change_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  changedUserId: uuid("changed_user_id")
    .notNull()
    .references(() => users.id),
  changedByUserId: uuid("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  fromRole: userRole("from_role").notNull(),
  toRole: userRole("to_role").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  experienceId: text("experience_id")
    .notNull()
    .references(() => experiences.id),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: moderationActionType("action").notNull(),
  reason: text("reason"), // REQUIRED for "hide" — enforced in the action layer
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Outreach (Invite to share) ───────────────────────────────────────────────
export const inviteCampaigns = pgTable("invite_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  fileName: text("file_name"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  readyCount: integer("ready_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inviteRecipients = pgTable("invite_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => inviteCampaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  role: text("role"),
  round: text("round"),
  status: inviteRecipientStatus("status").notNull(),
  skipReason: inviteSkipReason("skip_reason"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

// Reserved for the deferred community-flagging feature (no UI in V1).
export const flags = pgTable("flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull().default("experience"),
  targetId: text("target_id").notNull(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
