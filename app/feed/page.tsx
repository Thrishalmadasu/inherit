import { FeedView } from "@/components/feed/feed-view";
import { listFeedPage } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const initial = await listFeedPage({ sort: "latest", page: 1 });
  return <FeedView initial={initial} />;
}
