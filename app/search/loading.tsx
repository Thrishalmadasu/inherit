import { TopNav } from "@/components/top-nav";
import { Skeleton, SkeletonCardList } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[880px] px-7 pb-20 pt-7">
        <Skeleton className="mb-[22px] h-[52px] w-full rounded-xl" />
        <SkeletonCardList count={5} />
      </main>
    </>
  );
}
