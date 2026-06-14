import { TopNav } from "@/components/top-nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompaniesLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-7 pb-20 pt-7">
        <Skeleton className="mb-1.5 h-7 w-48" />
        <Skeleton className="mb-5 h-4 w-72" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] w-full rounded-lg" />
          ))}
        </div>
      </main>
    </>
  );
}
