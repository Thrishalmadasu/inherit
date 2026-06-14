import { TopNav } from "@/components/top-nav";
import { Skeleton, SkeletonCardList } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[880px] px-7 pb-20 pt-7">
        <Skeleton className="mb-1.5 h-7 w-56" />
        <Skeleton className="mb-5 h-4 w-80" />
        <Skeleton className="mb-3.5 h-[92px] w-full rounded-lg" />
        <SkeletonCardList count={6} />
      </main>
    </>
  );
}
