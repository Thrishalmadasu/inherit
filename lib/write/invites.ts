// Write core for Invite-to-share (PRD §7 Flow F). Same contract as the other
// cores: explicit actor, Zod at the boundary, one db.batch() so the campaign
// and its recipient rows land together or not at all.
//
// The client sends the RAW CSV text, not its parsed buckets — this core
// re-parses and re-buckets against fresh DB dedupe sets, so a student who
// shared (or got invited) between page load and Send is still skipped. The
// server's counts are the ones recorded and returned.
import { z } from "zod";
import { db, schema as s } from "@/lib/db";
import { getInviteDedupe } from "@/lib/db/queries";
import type { DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";
import { appOrigin, getEmailSender } from "@/lib/email";
import { applyMerge, buildRecipients, parseCsv, shareLinkPath } from "@/lib/invite";

const sendInvitesInput = z.object({
  csv: z.string().min(1, "Upload a CSV first").max(2_000_000, "CSV is too large"),
  fileName: z.string().max(200).nullable(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(10_000),
});

export interface SendInvitesResult {
  sent: number;
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
  const counts: SendInvitesResult = {
    sent: ready.length,
    skipped: recipients.filter((r) => r.status === "skip").length,
    errors: recipients.filter((r) => r.status === "error").length,
  };
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
      readyCount: counts.sent,
      skippedCount: counts.skipped,
      errorCount: counts.errors,
      sentAt: now,
    }),
    // Every row is recorded (audit trail); skip/error rows keep their reason.
    // Ready rows are stamped "sent" — dispatch below is the V1 stub, so there
    // is no per-recipient failure yet. When Resend lands (Session 5), this
    // becomes ready → dispatch → sent/failed per recipient.
    db.insert(s.inviteRecipients).values(
      recipients.map((r) => ({
        campaignId,
        email: r.email,
        name: r.name || null,
        company: r.company || null,
        role: r.role || null,
        round: r.round || null,
        status: (r.status === "ready" ? "sent" : "skipped") as "sent" | "skipped",
        skipReason: r.status === "ready" ? null : r.issues[0],
        sentAt: r.status === "ready" ? now : null,
      })),
    ),
  ]);

  // Dispatch AFTER the rows commit — an email must never exist without its
  // audit row. The console stub just logs each personalised send.
  const sender = getEmailSender();
  const origin = appOrigin();
  for (const r of ready) {
    await sender.sendInvite({
      to: r.email,
      subject: applyMerge(subject, r),
      body: applyMerge(body, r),
      replyTo: actor.sstEmail,
      ctaUrl: origin + shareLinkPath(r),
    });
  }

  return counts;
}
