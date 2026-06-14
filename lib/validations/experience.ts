// Zod schema for the share-form submission payload (Server Action input).
// Mirrors the localStorage draft types in lib/draft.ts 1:1 — the client sends
// its ShareDraftForm verbatim; we sanitize (trim, drop empty tips/blocks) and
// then validate. Canonical-vocabulary membership (topic tags, round types) is
// NOT checked here: it lives in the write cores, which re-resolve every label
// against the ACTIVE DB rows (topic_tags / round_types) — the single source of
// truth, so Ops-added entries work the instant they exist. Zod only guards
// shape and length. Company likewise can be a not-yet-canonical (proposed)
// name; the moderator resolves it during review.
import { z } from "zod";
import type { ShareDraftForm } from "@/lib/draft";
import { OUTCOMES, ROUND_STATUSES, wordCount } from "@/lib/share-form";

const blockSchema = z.object({
  type: z.enum(["coding", "system_design", "behavioral", "open"]),
  prompt: z.string().trim().min(1, "Every block needs its question/prompt").max(2000),
  topics: z.array(z.string().trim().min(1).max(60)).max(8),
  difficulty: z.number().int().min(1).max(5).nullable(),
  detail: z.string().trim().max(2000),
});

const roundSchema = z.object({
  round: z.string().trim().min(1, "Every round needs a name").max(40),
  status: z.enum(ROUND_STATUSES),
  detailed: z.boolean(),
  platform: z.string().trim().max(60),
  note: z.string().trim().max(200),
  blocks: z.array(blockSchema).max(12),
});

const tipSchema = z.object({
  category: z.enum(["resource", "strategy", "mindset"]),
  text: z.string().trim().min(1).max(240),
});

export const sharePayloadSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(80),
  role: z.string().trim().min(1, "Role is required").max(80),
  year: z.number().int().min(2020).max(2030),
  outcome: z.enum(OUTCOMES, { error: "Pick an overall outcome" }),
  rounds: z.array(roundSchema).min(1, "Add at least one round").max(12),
  tips: z.array(tipSchema).max(10),
  reflection: z
    .string()
    .trim()
    .max(6000)
    .refine((s) => wordCount(s) <= 500, "Reflections are capped at 500 words"),
  anonymous: z.boolean(),
});

export type SharePayload = z.infer<typeof sharePayloadSchema>;

// Drop the artifacts of an honest half-filled form (the empty seed tip, blocks
// the user added but never typed into) so they don't fail validation. Run
// BEFORE parsing, on both client and server.
export function sanitizeShareForm(f: ShareDraftForm): ShareDraftForm {
  return {
    ...f,
    company: f.company.trim(),
    role: f.role.trim(),
    rounds: f.rounds.map((r) => ({
      ...r,
      round: r.round.trim(),
      blocks: r.blocks.filter((b) => b.prompt.trim()),
    })),
    tips: f.tips.filter((t) => t.text.trim()),
    reflection: f.reflection.trim(),
  };
}

// One human-readable line for the first validation problem (toast-friendly).
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? i.message : "Invalid submission";
}
