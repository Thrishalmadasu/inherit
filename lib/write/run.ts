// Shared wrapper for Server Action endpoints: run a write core, map
// WriteError → a toastable message, and purge the client router cache for the
// whole (fully dynamic) route tree so statuses change everywhere at once.
// Lives outside app/actions/* on purpose — "use server" files may only export
// endpoints, and this is plumbing, not an endpoint.
import { revalidatePath } from "next/cache";
import { WriteError } from "@/lib/write/experiences";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionDataResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function runAction(fn: () => Promise<unknown>): Promise<ActionResult> {
  const r = await runActionData(fn);
  return r.ok ? { ok: true } : r;
}

// Same contract, but the core's return value travels back to the client
// (e.g. the server-counted invite totals for the success banner).
export async function runActionData<T>(fn: () => Promise<T>): Promise<ActionDataResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof WriteError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong — please try again" };
  }
}
