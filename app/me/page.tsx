import { MyPostsView } from "@/components/me/my-posts-view";
import { requireDbUser } from "@/lib/auth";
import { getMyPosts, getSavedExperiences } from "@/lib/db/queries";

// My Posts - the author's own rows in every state (the visibility invariant
// deliberately does NOT apply to your own posts), plus the Saved tab
// (bookmarked posts by OTHERS - those do go through the invariant).
export default async function MyPostsPage() {
  const user = await requireDbUser();
  const [posts, saved] = await Promise.all([
    getMyPosts(user.id),
    getSavedExperiences(user.id, { page: 1 }),
  ]);
  return <MyPostsView posts={posts} saved={saved} />;
}
