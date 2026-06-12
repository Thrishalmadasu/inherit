"use server";
// Ops moderation endpoints (Flow E) — moderator/super_admin only.
import { after } from "next/server";
import { requireOps } from "@/lib/auth";
import { syncPublishedExperience } from "@/lib/sheets";
import {
  approveCore,
  hideCore,
  rejectCore,
  suggestEditsCore,
  unhideCore,
} from "@/lib/write/moderation";
import { runAction, type ActionResult } from "@/lib/write/run";

export async function approveExperience(expId: string): Promise<ActionResult> {
  const actor = await requireOps();
  const result = await runAction(() => approveCore(actor, expId));
  // L&D sheet append (PRD §13): runs after the response is sent (Vercel
  // waitUntil under the hood), retries inside, never blocks or fails the
  // publish. The trigger lives here rather than in the core because after()
  // needs a request scope — the invariant test calls the sync directly.
  if (result.ok) after(() => syncPublishedExperience(expId));
  return result;
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
  const actor = await requireOps();
  return runAction(() => hideCore(actor, expId, reason));
}

export async function unhideExperience(expId: string): Promise<ActionResult> {
  const actor = await requireOps();
  return runAction(() => unhideCore(actor, expId));
}
