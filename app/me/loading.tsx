import { TopNav } from "@/components/top-nav";
import { Skeleton, SkeletonCardList } from "@/components/ui/skeleton";

export default function MeLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[880px] px-7 pb-20 pt-7">
        <Skeleton className="mb-1.5 h-7 w-40" />
        <Skeleton className="mb-5 h-4 w-72" />
        <div className="mb-3.5 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <SkeletonCardList count={4} />
      </main>
    </>
  );
}
