// Shared wrapper for Server Action endpoints: run a write core, map
// WriteError → a toastable message, and purge the client router cache for the
// whole (fully dynamic) route tree so statuses change everywhere at once.
// Lives outside app/actions/* on purpose — "use server" files may only export
// endpoints, and this is plumbing, not an endpoint.
import { revalidatePath } from "next/cache";
import { WriteError } from "@/lib/write/experiences";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function runAction(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof WriteError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong — please try again" };
  }
}
