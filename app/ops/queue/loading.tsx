import { Skeleton, SkeletonRowList } from "@/components/ui/skeleton";

export default function OpsQueueLoading() {
  return (
    <>
      <div className="mb-3.5 flex flex-wrap gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <SkeletonRowList count={6} />
    </>
  );
}
