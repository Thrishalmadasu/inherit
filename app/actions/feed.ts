"use server";
// Read endpoint for the paginated feed - lets the client fetch more pages (and
// re-query on filter/sort change) without loading the whole corpus up front.
// Signed-in only, like every other read surface.
import { requireDbUser } from "@/lib/auth";
import { listFeedPage, type FeedPage, type FeedQuery } from "@/lib/db/queries";

export async function fetchFeedPage(opts: FeedQuery): Promise<FeedPage> {
  await requireDbUser();
  return listFeedPage(opts);
}
