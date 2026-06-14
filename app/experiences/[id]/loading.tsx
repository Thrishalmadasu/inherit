import { TopNav } from "@/components/top-nav";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExperienceLoading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-9 px-7 pb-20 pt-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Skeleton className="mb-[18px] h-3.5 w-64" />
          <div className="mb-6 border-b border-border pb-6">
            <div className="mb-3.5 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="mb-6">
              <Skeleton className="mb-3 h-5 w-40" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <aside className="flex flex-col gap-3.5">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </aside>
      </main>
    </>
  );
}
