import { cn } from "@/lib/cn";

// Base shimmer block. Everything else composes this. aria-hidden — it's a
// visual placeholder, not content a screen reader should announce.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-surface-3", className)} />;
}

// Mimics components/ui/experience-card.tsx: head row, pipeline chips, foot row.
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface px-[18px] py-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Skeleton className="size-[22px] rounded-[6px]" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <div className="my-[10px] flex gap-1.5">
        <Skeleton className="h-[22px] w-14 rounded-full" />
        <Skeleton className="h-[22px] w-16 rounded-full" />
        <Skeleton className="h-[22px] w-12 rounded-full" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// A column of N SkeletonCards — the shape every list view loads into.
export function SkeletonCardList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// A single bordered row (used for table-ish / list rows).
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-[18px] py-3.5">
      <Skeleton className="size-[34px] rounded-[8px]" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

export function SkeletonRowList({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
