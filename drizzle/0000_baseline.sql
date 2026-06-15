CREATE TYPE "public"."block_type" AS ENUM('coding', 'system_design', 'behavioral', 'open');--> statement-breakpoint
CREATE TYPE "public"."invite_recipient_status" AS ENUM('ready', 'skipped', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invite_skip_reason" AS ENUM('duplicate_in_file', 'already_shared', 'invalid_email', 'missing_email', 'already_invited');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_type" AS ENUM('hide', 'unhide');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('post_under_review', 'post_live', 'post_needs_edits', 'post_rejected', 'post_hidden');--> statement-breakpoint
CREATE TYPE "public"."overall_outcome" AS ENUM('Offer', 'Shortlisted', 'Awaiting', 'Rejected', 'Withdrew');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('under_review', 'approved', 'needs_edits', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('Passed', 'Failed', 'Awaiting');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('dsa', 'system_design', 'behavioral', 'tooling', 'domain', 'other');--> statement-breakpoint
CREATE TYPE "public"."tip_category" AS ENUM('resource', 'strategy', 'mindset');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'moderator', 'super_admin');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"industry" text,
	"location" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_block_topic_tags" (
	"block_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "content_block_topic_tags_block_id_tag_id_pk" PRIMARY KEY("block_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"block_type" "block_type" NOT NULL,
	"prompt" text NOT NULL,
	"difficulty" integer,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"company_id" uuid,
	"proposed_company_name" text,
	"role_title" text NOT NULL,
	"role_type_id" uuid,
	"year" integer NOT NULL,
	"overall_outcome" "overall_outcome" NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"overview" text,
	"reflection_text" text,
	"review_status" "review_status" DEFAULT 'under_review' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer,
	"imported_from_archive" boolean DEFAULT false NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text DEFAULT 'experience' NOT NULL,
	"target_id" text NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invite_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"file_name" text,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"ready_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"company" text,
	"role" text,
	"round" text,
	"status" "invite_recipient_status" NOT NULL,
	"skip_reason" "invite_skip_reason",
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "moderation_action_type" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"experience_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prep_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"category" "tip_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"experience_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_change_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changed_user_id" uuid NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"from_role" "user_role" NOT NULL,
	"to_role" "user_role" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "round_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"status" "round_status" NOT NULL,
	"is_detailed" boolean DEFAULT false NOT NULL,
	"platform" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "saved_experiences" (
	"user_id" uuid NOT NULL,
	"experience_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_experiences_user_id_experience_id_pk" PRIMARY KEY("user_id","experience_id")
);
--> statement-breakpoint
CREATE TABLE "topic_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"category" "tag_category" NOT NULL,
	"is_dsa" boolean DEFAULT false NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "topic_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sst_email" text NOT NULL,
	"name" text NOT NULL,
	"batch_year" integer,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"display_handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_sst_email_unique" UNIQUE("sst_email")
);
--> statement-breakpoint
ALTER TABLE "content_block_topic_tags" ADD CONSTRAINT "content_block_topic_tags_block_id_content_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."content_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block_topic_tags" ADD CONSTRAINT "content_block_topic_tags_tag_id_topic_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."topic_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_role_type_id_role_types_id_fk" FOREIGN KEY ("role_type_id") REFERENCES "public"."role_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_campaigns" ADD CONSTRAINT "invite_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_recipients" ADD CONSTRAINT "invite_recipients_campaign_id_invite_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."invite_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_tips" ADD CONSTRAINT "prep_tips_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_change_audit" ADD CONSTRAINT "role_change_audit_changed_user_id_users_id_fk" FOREIGN KEY ("changed_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_change_audit" ADD CONSTRAINT "role_change_audit_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_types" ADD CONSTRAINT "role_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_types" ADD CONSTRAINT "round_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_experiences" ADD CONSTRAINT "saved_experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_experiences" ADD CONSTRAINT "saved_experiences_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_user_experience_uq" ON "reactions" USING btree ("user_id","experience_id");