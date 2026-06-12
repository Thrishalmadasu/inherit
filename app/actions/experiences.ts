"use server";
// Auth-gated Server Action endpoint for the share form (Flows B & C):
// resolve the actor from the Clerk session, run the core in lib/write/*.
import { requireDbUser } from "@/lib/auth";
import type { ShareDraftForm } from "@/lib/draft";
import { resubmitExperienceCore, submitExperienceCore } from "@/lib/write/experiences";
import { runAction, type ActionResult } from "@/lib/write/run";

export async function submitExperience(
  form: ShareDraftForm,
  editId?: string,
): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() =>
    editId ? resubmitExperienceCore(actor, editId, form) : submitExperienceCore(actor, form),
  );
}
