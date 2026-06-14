import { Skeleton, SkeletonRowList } from "@/components/ui/skeleton";

export default function OpsTaxonomyLoading() {
  return (
    <>
      <Skeleton className="mb-3.5 h-9 w-[320px] rounded-md" />
      <SkeletonRowList count={8} />
    </>
  );
}
