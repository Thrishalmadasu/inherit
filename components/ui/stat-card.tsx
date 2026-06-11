import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";

type IconCmp = (p: SVGProps<SVGSVGElement>) => ReactNode;

export function StatCard({
  label,
  icon: Ic,
  value,
  sub,
  active = false,
  onClick,
}: {
  label: string;
  icon: IconCmp;
  value: ReactNode;
  sub: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-surface px-[18px] pb-[18px] pt-4 text-left transition-[border-color,background,box-shadow] duration-200",
        interactive && "cursor-pointer hover:border-border-hover",
        active
          ? "border-blue-border bg-[linear-gradient(180deg,rgba(46,160,248,0.04),transparent),var(--color-surface)] shadow-[0_0_0_1px_var(--color-blue-border),0_0_24px_-6px_var(--color-blue-glow),inset_0_1px_0_rgba(46,160,248,0.08)]"
          : "border-border",
      )}
    >
      <div
        className={cn(
          "mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] [&_svg]:size-[13px]",
          active ? "text-blue" : "text-fg-3",
        )}
      >
        <Ic /> {label}
      </div>
      <div className="text-[32px] font-bold leading-none tracking-[-0.02em]">
        {value}
      </div>
      <div className="mt-1.5 text-xs text-fg-3">{sub}</div>
    </Tag>
  );
}
