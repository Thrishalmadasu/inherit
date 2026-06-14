"use server";
// Engagement endpoints: Helpful vote, save/bookmark, unique view tracking.
import { requireDbUser } from "@/lib/auth";
import { recordViewCore, setHelpfulCore, setSavedCore } from "@/lib/write/engagement";
import { runAction, type ActionResult } from "@/lib/write/run";

export async function setHelpful(expId: string, on: boolean): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => setHelpfulCore(actor, expId, on));
}

export async function setSaved(expId: string, on: boolean): Promise<ActionResult> {
  const actor = await requireDbUser();
  return runAction(() => setSavedCore(actor, expId, on));
}

// Fired from the experience page on mount. Deliberately NOT runAction: a view
// shouldn't purge the router cache on every visit, and failures are silent -
// losing a view beat breaking the page.
export async function recordView(expId: string): Promise<void> {
  try {
    const actor = await requireDbUser();
    await recordViewCore(actor, expId);
  } catch (e) {
    console.error("recordView", e);
  }
}
