"use server";
// Ops moderation endpoints (Flow E). Review actions (approve/suggest/reject)
// allow any Ops user (incl. the OPS_EMAILS bootstrap); DESTRUCTIVE hide/unhide
// require the moderator+ ROLE (requireModerator) so student-ops can't hide a
// live post by mistake (concern #4).
import { after } from "next/server";
import { requireModerator, requireOps } from "@/lib/auth";
import { syncPublishedExperience } from "@/lib/sheets";
import {
  approveCore,
  hideCore,
  rejectCore,
  resolveExperienceCompanyCore,
  suggestEditsCore,
  unhideCore,
  type CompanyResolution,
} from "@/lib/write/moderation";
import { runActionData, runAction, type ActionDataResult, type ActionResult } from "@/lib/write/run";

export async function approveExperience(expId: string): Promise<ActionResult> {
  const actor = await requireOps();
  const result = await runAction(() => approveCore(actor, expId));
  // L&D sheet append (PRD §13): runs after the response is sent (Vercel
  // waitUntil under the hood), retries inside, never blocks or fails the
  // publish. The trigger lives here rather than in the core because after()
  // needs a request scope - the invariant test calls the sync directly.
  if (result.ok) after(() => syncPublishedExperience(expId));
  return result;
}

// Resolve a proposed company during review (concern #10) - map to an existing
// canonical company or promote it. Any Ops user can do this (it's part of the
// review), like approve/suggest/reject.
export async function resolveExperienceCompany(
  expId: string,
  resolution: CompanyResolution,
): Promise<ActionDataResult<{ companyName: string }>> {
  const actor = await requireOps();
  return runActionData(() => resolveExperienceCompanyCore(actor, expId, resolution));
}

export async function suggestEdits(expId: string, note: string): Promise<ActionResult> {
  const actor = await requireOps();
  return runAction(() => suggestEditsCore(actor, expId, note));
}

export async function rejectExperience(expId: string, reason: string): Promise<ActionResult> {
  const actor = await requireOps();
  return runAction(() => rejectCore(actor, expId, reason));
}

export async function hideExperience(expId: string, reason: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => hideCore(actor, expId, reason));
}

export async function unhideExperience(expId: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => unhideCore(actor, expId));
}
