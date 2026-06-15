import { FeedView } from "@/components/feed/feed-view";
import { getFeedRoundFilters, listFeedPage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const [initial, roundFilters] = await Promise.all([
    listFeedPage({ sort: "latest", page: 1 }),
    getFeedRoundFilters(),
  ]);
  return <FeedView initial={initial} roundFilters={roundFilters} />;
}
