import { TopNav } from "@/components/top-nav";
import { Skeleton, SkeletonCardList } from "@/components/ui/skeleton";

export default function CompanyLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-7 pb-20 pt-7">
        <div className="mb-6 flex items-center gap-4 border-b border-border pb-6">
          <Skeleton className="size-[52px] rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <SkeletonCardList count={4} />
      </main>
    </>
  );
}
