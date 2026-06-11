import { FeedView } from "@/components/feed/feed-view";
import { listFeed } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const items = await listFeed();
  return <FeedView items={items} />;
}
