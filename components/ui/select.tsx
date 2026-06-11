import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Chevron rendered as a background data-URI (matches the prototype's native
// <select> styling).
const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a91a3' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")";

const BASE =
  "h-[34px] cursor-pointer appearance-none rounded-md border border-border pl-3 pr-8 text-[13px] font-medium text-fg outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-border-hover hover:bg-surface-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)] [&>option]:bg-surface";

export function Select({
  variant = "filter",
  className,
  ...rest
}: ComponentProps<"select"> & { variant?: "filter" | "sort" }) {
  return (
    <select
      {...rest}
      className={cn(
        BASE,
        variant === "filter" ? "min-w-[160px] bg-bg-2" : "rounded-[8px] bg-surface",
        className,
      )}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        backgroundSize: "12px 12px",
        ...rest.style,
      }}
    />
  );
}
