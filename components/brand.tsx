import Image from "next/image";
import { cn } from "@/lib/cn";

// The SST logo mark (transparent shield) — the single source for the co-brand
// lockup ("SST Inherit"). Swap `public/logosst.webp` to rebrand everywhere.
// Intrinsic 96×97; size it with a className (e.g. "size-[26px]").
export function BrandMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logosst.webp"
      alt="SST Inherit"
      width={96}
      height={97}
      priority={priority}
      // Tiny transparent logo: skip optimization so alpha is never flattened to
      // a JPEG fallback for clients that don't advertise webp/avif.
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}
