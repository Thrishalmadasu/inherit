import { Skeleton, SkeletonRowList } from "@/components/ui/skeleton";

export default function OpsUsersLoading() {
  return (
    <>
      <Skeleton className="mb-3.5 h-[34px] w-[340px] rounded-md" />
      <SkeletonRowList count={8} />
    </>
  );
}
