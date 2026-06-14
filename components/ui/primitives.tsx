import { cn } from "@/lib/cn";
import type { Author as AuthorType } from "@/lib/types";

// ─── Difficulty bars 1–5 ───────────────────────────────────────────────────
export function Difficulty({ value }: { value: number }) {
  const hard = value >= 4;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`Difficulty ${value}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "w-1 h-[9px] rounded-[1px]",
            n <= value
              ? hard
                ? "bg-red shadow-[0_0_4px_rgba(239,90,90,0.4)]"
                : "bg-amber shadow-[0_0_4px_rgba(245,181,68,0.4)]"
              : "bg-gray-soft",
          )}
        />
      ))}
    </span>
  );
}

// ─── Author byline (real or anonymous) ─────────────────────────────────────
export function Author({ author }: { author: AuthorType }) {
  if (author.anonymous) {
    return (
      <span className="inline-flex items-center gap-[7px] italic text-fg-3">
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full border border-border-strong bg-bg-2 text-[9.5px] font-semibold not-italic text-fg-3">
          ?
        </span>
        {author.batch ? `SST ${author.batch} student` : "SST student"}
      </span>
    );
  }
  const initials = (author.name ?? "")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="inline-flex items-center gap-[7px] text-fg-2">
      <span className="grid size-[18px] shrink-0 place-items-center rounded-full border border-border-strong bg-surface-3 text-[9.5px] font-semibold text-fg-2">
        {initials}
      </span>
      {author.name}
      {author.batch && ` · ${author.batch}`}
    </span>
  );
}

// ─── Inline dot separator ──────────────────────────────────────────────────
export function Dot() {
  return <span className="size-[3px] shrink-0 rounded-full bg-fg-4" />;
}

// ─── Filter chip ───────────────────────────────────────────────────────────
export function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active?: boolean;
  onClick?: () => void;
  label: string;
  count?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border px-[11px] text-[12.5px] font-medium transition-[border-color,color,background,box-shadow] duration-150",
        active
          ? "border-blue-border bg-blue-soft text-blue shadow-[0_0_0_1px_var(--color-blue-border),0_0_14px_-4px_var(--color-blue-glow)]"
          : "border-border bg-surface text-fg-2 hover:border-border-hover hover:text-fg",
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[11px]",
            active ? "bg-[rgba(46,160,248,0.18)] text-blue" : "bg-gray-soft text-fg-3",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
