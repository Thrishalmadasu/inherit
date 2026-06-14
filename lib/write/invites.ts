// Write core for Invite-to-share (PRD §7 Flow F). Same contract as the other
// cores: explicit actor, Zod at the boundary, one db.batch() so the campaign
// and its recipient rows land together or not at all.
//
// The client sends the RAW CSV text, not its parsed result — this core
// re-parses and re-validates server-side (the client is never trusted) and
// returns the counts it recorded. NO dedupe (product decision 2026-06-13): every row with
// a valid email sends, including duplicates and re-runs. Ops owns recipient
// selection; a student with several interviews is invited per experience.
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";
import { appOrigin, getEmailSender } from "@/lib/email";
import {
  applyMerge,
  buildManualRecipients,
  buildRecipients,
  parseCsv,
  shareLinkPath,
} from "@/lib/invite";

type Batchable = Parameters<typeof db.batch>[0][number];

const fieldStr = z.string().max(200);
// Recipients arrive as a raw CSV (re-parsed here) and/or a list of manually
// entered rows (the add-recipient form). Both are re-validated server-side by
// the SAME classifier — the client is never trusted. At least one source must
// yield a recipient (checked after building, not in the schema).
const sendInvitesInput = z.object({
  csv: z.string().max(2_000_000, "CSV is too large").default(""),
  manual: z
    .array(
      z.object({
        name: fieldStr,
        email: fieldStr,
        company: fieldStr,
        role: fieldStr,
        round: fieldStr,
      }),
    )
    .max(500)
    .default([]),
  fileName: z.string().max(200).nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(10_000),
});

export interface SendInvitesResult {
  sent: number; // dispatched OK
  failed: number; // dispatch failed after retries — re-send by re-uploading
  errors: number; // missing/invalid email, never dispatched
}

export async function sendInvitesCore(actor: DbUser, input: unknown): Promise<SendInvitesResult> {
  const parsed = sendInvitesInput.safeParse(input);
  if (!parsed.success) throw new WriteError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { csv, manual, fileName, subject, body } = parsed.data;

  // CSV rows first, then manually-entered rows — one combined recipient list
  // flows through the identical dispatch + audit path.
  const recipients = [
    ...(csv.trim() ? buildRecipients(parseCsv(csv)) : []),
    ...buildManualRecipients(manual),
  ];
  if (!recipients.length) throw new WriteError("Add at least one recipient (CSV or manual)");

  const ready = recipients.filter((r) => r.status === "ready");
  const errors = recipients.filter((r) => r.status === "error").length;
  if (!ready.length)
    throw new WriteError("No valid recipients — every row was missing or had an invalid email");

  // Explicit ids on every recipient row: duplicates are allowed now, so an
  // email no longer identifies one row — we stamp dispatch results back by id.
  const campaignId = crypto.randomUUID();
  const now = new Date();
  const rows = recipients.map((r) => ({
    id: crypto.randomUUID(),
    campaignId,
    email: r.email,
    name: r.name || null,
    company: r.company || null,
    role: r.role || null,
    round: r.round || null,
    status: (r.status === "ready" ? "ready" : "skipped") as "ready" | "skipped",
    skipReason: r.status === "ready" ? null : r.issues[0],
    sentAt: null as Date | null,
  }));
  await db.batch([
    db.insert(s.inviteCampaigns).values({
      id: campaignId,
      createdByUserId: actor.id,
      fileName,
      subjectTemplate: subject,
      bodyTemplate: body,
      readyCount: ready.length,
      skippedCount: 0, // no dedupe-skips anymore; bad-email rows are errorCount
      errorCount: errors,
      sentAt: now,
    }),
    // Every row recorded BEFORE dispatch (an email must never exist without
    // its audit row): "ready" rows are stamped sent/failed from the dispatch
    // results below; bad-email rows go in as "skipped" with their reason.
    db.insert(s.inviteRecipients).values(rows),
  ]);

  // Dispatch (Resend batch endpoint in prod, console stub without a key) —
  // never throws; per-recipient results come back instead (PRD §12:
  // "InviteRecipient.status updated per row"). results aligns positionally
  // with `ready`, which aligns with `readyRows` (filter preserves order).
  const origin = appOrigin();
  const readyRows = rows.filter((row) => row.status === "ready");
  const results = await getEmailSender().sendInvites(
    ready.map((r) => ({
      to: r.email,
      subject: applyMerge(subject, r),
      body: applyMerge(body, r),
      replyTo: actor.sstEmail,
      ctaUrl: origin + shareLinkPath(r),
    })),
  );
  const okIds: string[] = [];
  const failedIds: string[] = [];
  results.forEach((res, i) => (res.ok ? okIds : failedIds).push(readyRows[i].id));

  const stamps: Batchable[] = [];
  if (okIds.length)
    stamps.push(
      db
        .update(s.inviteRecipients)
        .set({ status: "sent", sentAt: new Date() })
        .where(inArray(s.inviteRecipients.id, okIds)),
    );
  // Failed rows stay "failed" — no email went out, so re-uploading re-sends them.
  if (failedIds.length)
    stamps.push(
      db
        .update(s.inviteRecipients)
        .set({ status: "failed" })
        .where(inArray(s.inviteRecipients.id, failedIds)),
    );
  if (stamps.length) await db.batch(stamps as [Batchable, ...Batchable[]]);
  if (failedIds.length)
    console.error(
      `[invites] ${failedIds.length}/${ready.length} dispatches failed:`,
      results.filter((x) => !x.ok).map((x) => `${x.to}: ${x.error}`),
    );

  return { sent: okIds.length, failed: failedIds.length, errors };
}
