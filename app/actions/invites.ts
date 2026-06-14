"use server";
// Invite-to-share endpoint (PRD §7 Flow F) — moderator/super_admin only.
import { requireOps } from "@/lib/auth";
import type { RecipientFields } from "@/lib/invite";
import { sendInvitesCore, type SendInvitesResult } from "@/lib/write/invites";
import { runActionData, type ActionDataResult } from "@/lib/write/run";

export async function sendInvites(input: {
  csv: string;
  manual?: RecipientFields[];
  fileName: string | null;
  subject: string;
  body: string;
}): Promise<ActionDataResult<SendInvitesResult>> {
  const actor = await requireOps();
  return runActionData(() => sendInvitesCore(actor, input));
}
