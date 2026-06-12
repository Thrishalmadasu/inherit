import { MyPostsView } from "@/components/me/my-posts-view";
import { requireDbUser } from "@/lib/auth";
import { getMyPosts } from "@/lib/db/queries";

// My Posts — the author's own rows in every state (the visibility invariant
// deliberately does NOT apply to your own posts).
export default async function MyPostsPage() {
  const user = await requireDbUser();
  const posts = await getMyPosts(user.id);
  return <MyPostsView posts={posts} />;
}
