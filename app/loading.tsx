import { TopNav } from "@/components/top-nav";
import { Skeleton, SkeletonRowList } from "@/components/ui/skeleton";

// Home shell loads instantly; the search bar + data sections shimmer until the
// DB reads resolve (the page is force-dynamic).
export default function HomeLoading() {
  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[1080px] px-7 pb-20 pt-7">
        {/* Hero - static copy stays, search bar shimmers */}
        <div className="py-10 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
            SST Placement Knowledge Base
          </div>
          <h1 className="mb-2.5 text-[36px] font-bold leading-[1.15] tracking-[-0.03em]">
            What are you prepping for <span className="text-blue">today?</span>
          </h1>
          <p className="mb-6 text-[15px] leading-[1.55] text-fg-2">
            Every OA, interview, and offer your batchmates have been through -
            searchable in one place.
          </p>
          <Skeleton className="mx-auto h-[52px] w-full max-w-[640px] rounded-xl" />
          <div className="mt-[18px] flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[26px] w-20 rounded-full" />
            ))}
          </div>
        </div>

        {/* Latest across SST */}
        <section className="mt-9">
          <Skeleton className="mb-3.5 h-5 w-44" />
          <SkeletonRowList count={6} />
        </section>

        {/* Companies */}
        <section className="mt-9">
          <Skeleton className="mb-3.5 h-5 w-56" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[132px] w-full rounded-lg" />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
