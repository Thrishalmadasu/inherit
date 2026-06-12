// Write core for Invite-to-share (PRD §7 Flow F). Same contract as the other
// cores: explicit actor, Zod at the boundary, one db.batch() so the campaign
// and its recipient rows land together or not at all.
//
// The client sends the RAW CSV text, not its parsed buckets — this core
// re-parses and re-buckets against fresh DB dedupe sets, so a student who
// shared (or got invited) between page load and Send is still skipped. The
// server's counts are the ones recorded and returned.
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { getInviteDedupe } from "@/lib/db/queries";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";
import { appOrigin, getEmailSender } from "@/lib/email";
import { applyMerge, buildRecipients, parseCsv, shareLinkPath } from "@/lib/invite";

type Batchable = Parameters<typeof db.batch>[0][number];

const sendInvitesInput = z.object({
  csv: z.string().min(1, "Upload a CSV first").max(2_000_000, "CSV is too large"),
  fileName: z.string().max(200).nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(10_000),
});

export interface SendInvitesResult {
  sent: number; // dispatched OK
  failed: number; // dispatch failed after retries — re-invitable next CSV
  skipped: number;
  errors: number;
}

export async function sendInvitesCore(actor: DbUser, input: unknown): Promise<SendInvitesResult> {
  const parsed = sendInvitesInput.safeParse(input);
  if (!parsed.success) throw new WriteError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { csv, fileName, subject, body } = parsed.data;

  const dedupe = await getInviteDedupe();
  const recipients = buildRecipients(parseCsv(csv), {
    alreadyShared: new Set(dedupe.alreadyShared),
    alreadyInvited: new Set(dedupe.alreadyInvited),
  });
  if (!recipients.length) throw new WriteError("No recipient rows found in the CSV");

  const ready = recipients.filter((r) => r.status === "ready");
  const skipped = recipients.filter((r) => r.status === "skip").length;
  const errors = recipients.filter((r) => r.status === "error").length;
  if (!ready.length) throw new WriteError("No ready recipients — everyone was skipped or errored");

  // Explicit id so the campaign + its recipients fit in one batch.
  const campaignId = crypto.randomUUID();
  const now = new Date();
  await db.batch([
    db.insert(s.inviteCampaigns).values({
      id: campaignId,
      createdByUserId: actor.id,
      fileName,
      subjectTemplate: subject,
      bodyTemplate: body,
      readyCount: ready.length,
      skippedCount: skipped,
      errorCount: errors,
      sentAt: now,
    }),
    // Every row is recorded BEFORE dispatch (an email must never exist
    // without its audit row): ready rows go in as "ready" and are stamped
    // sent/failed from the dispatch results below; skip/error rows keep
    // their reason. "ready" also counts toward the already-invited dedupe
    // set, so a crash mid-dispatch can never cause a double-send later.
    db.insert(s.inviteRecipients).values(
      recipients.map((r) => ({
        campaignId,
        email: r.email,
        name: r.name || null,
        company: r.company || null,
        role: r.role || null,
        round: r.round || null,
        status: (r.status === "ready" ? "ready" : "skipped") as "ready" | "skipped",
        skipReason: r.status === "ready" ? null : r.issues[0],
        sentAt: null,
      })),
    ),
  ]);

  // Dispatch (Resend batch endpoint in prod, console stub without a key) —
  // never throws; per-recipient results come back instead (PRD §12:
  // "InviteRecipient.status updated per row").
  const origin = appOrigin();
  const results = await getEmailSender().sendInvites(
    ready.map((r) => ({
      to: r.email,
      subject: applyMerge(subject, r),
      body: applyMerge(body, r),
      replyTo: actor.sstEmail,
      ctaUrl: origin + shareLinkPath(r),
    })),
  );
  const okEmails = results.filter((x) => x.ok).map((x) => x.to);
  const failedEmails = results.filter((x) => !x.ok).map((x) => x.to);
  const stamps: Batchable[] = [];
  if (okEmails.length)
    stamps.push(
      db
        .update(s.inviteRecipients)
        .set({ status: "sent", sentAt: new Date() })
        .where(
          and(
            eq(s.inviteRecipients.campaignId, campaignId),
            inArray(s.inviteRecipients.email, okEmails),
          ),
        ),
    );
  // Failed rows leave the dedupe set (no email went out) — re-uploading the
  // same CSV retries exactly these recipients.
  if (failedEmails.length)
    stamps.push(
      db
        .update(s.inviteRecipients)
        .set({ status: "failed" })
        .where(
          and(
            eq(s.inviteRecipients.campaignId, campaignId),
            inArray(s.inviteRecipients.email, failedEmails),
          ),
        ),
    );
  await db.batch(stamps as [Batchable, ...Batchable[]]);
  if (failedEmails.length)
    console.error(
      `[invites] ${failedEmails.length}/${ready.length} dispatches failed:`,
      results.filter((x) => !x.ok).map((x) => `${x.to}: ${x.error}`),
    );

  return { sent: okEmails.length, failed: failedEmails.length, skipped, errors };
}
