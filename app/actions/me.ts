"use server";
// Read endpoint for the paginated Saved tab ("Load more"). Resolves the current
// user server-side — never trusts a client-supplied id.
import { requireDbUser } from "@/lib/auth";
import { getSavedExperiences, type Paginated } from "@/lib/db/queries";
import type { Experience } from "@/lib/types";

export async function fetchSavedPage(opts: { page?: number }): Promise<Paginated<Experience>> {
  const user = await requireDbUser();
  return getSavedExperiences(user.id, opts);
}
