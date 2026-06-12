"use server";
// Ops moderation endpoints (Flow E) — moderator/super_admin only.
import { requireOps } from "@/lib/auth";
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
  return runAction(() => approveCore(actor, expId));
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
