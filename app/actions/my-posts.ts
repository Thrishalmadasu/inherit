"use server";
// Author self-service endpoints: soft-delete / restore / withdraw / resubmit.
import { requireDbUser } from "@/lib/auth";
import {
  deleteMyPostCore,
  restoreMyPostCore,
  resubmitWithdrawnCore,
  withdrawMyPostCore,
} from "@/lib/write/my-posts";
import { runAction, type ActionResult } from "@/lib/write/run";

export async function deleteMyPost(expId: string): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => deleteMyPostCore(actor, expId));
}

export async function restoreMyPost(expId: string): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => restoreMyPostCore(actor, expId));
}

export async function withdrawMyPost(expId: string): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => withdrawMyPostCore(actor, expId));
}

export async function resubmitWithdrawn(expId: string): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => resubmitWithdrawnCore(actor, expId));
}
