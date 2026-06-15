"use server";
// Read endpoint for the paginated Saved tab ("Load more"). Resolves the current
// user server-side - never trusts a client-supplied id.
import { requireDbUser } from "@/lib/auth";
import {
  getMyPosts,
  getSavedExperiences,
  type MyPostsPage,
  type Paginated,
} from "@/lib/db/queries";
import type { Experience, ReviewStatus } from "@/lib/types";

export async function fetchSavedPage(opts: { page?: number }): Promise<Paginated<Experience>> {
  const user = await requireDbUser();
  return getSavedExperiences(user.id, opts);
}

// Read endpoint for the paginated + searchable My Posts list. Status filter and
// search compose server-side so the page never loads the whole authored set.
export async function fetchMyPosts(opts: {
  status?: ReviewStatus | "all";
  search?: string;
  page?: number;
}): Promise<MyPostsPage> {
  const user = await requireDbUser();
  return getMyPosts(user.id, opts);
}
