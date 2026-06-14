"use server";
// Read endpoint for /search — server-side experience search so the page never
// loads the whole corpus. Signed-in only, like every other read surface.
import { requireDbUser } from "@/lib/auth";
import { searchExperiences as searchExperiencesQuery } from "@/lib/db/queries";
import type { Experience } from "@/lib/types";

export async function searchExperiences(q: string): Promise<Experience[]> {
  await requireDbUser();
  return searchExperiencesQuery(q, 20);
}
