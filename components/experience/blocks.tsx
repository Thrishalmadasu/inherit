// Shared post-content blocks — used by the experience detail page and the
// author's under-review preview (and later, the Ops queue full-post view).
import { Icon } from "@/components/icons";
import { Difficulty } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { PrepTip as PrepTipType, QuestionDetail } from "@/lib/mock/data";

export function QuestionCard({ q }: { q: QuestionDetail }) {
  return (
    <div className="relative mb-2.5 rounded-lg border border-border bg-surface py-[18px] pl-16 pr-5 transition-colors hover:border-border-hover">
      <div className="absolute left-[18px] top-[18px] grid size-8 place-items-center rounded-full border border-border-strong bg-bg-2 text-[13px] font-semibold tabular-nums text-fg-2">
        {q.n}
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-[14.5px] font-semibold tracking-[-0.005em] text-fg">
          {q.topic}
        </span>
        <span className="ml-auto flex items-center gap-2.5 text-xs text-fg-3">
          <Difficulty value={q.difficulty} />
          <span className="size-[3px] rounded-full bg-fg-4" />
          <span className="inline-flex items-center gap-1">
            <Icon.clock className="size-3" /> {q.time}
          </span>
          <span className="size-[3px] rounded-full bg-fg-4" />
          <span>{q.platform}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-[1.6] text-fg-2">{q.summary}</p>
      {q.approach && (
        <div className="mt-3 rounded-md border border-border bg-bg-2 px-[13px] py-[11px] text-[13px] leading-[1.6] text-fg-2">
          <b className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-blue">
            Approach
          </b>
          {q.approach}
        </div>
      )}
    </div>
  );
}

const TIP_CATS = {
  resource: { Ic: Icon.book, label: "Resource", cls: "bg-blue-soft text-blue border-blue-border" },
  strategy: {
    Ic: Icon.target,
    label: "Strategy",
    cls: "bg-[rgba(122,90,224,0.12)] text-[#a486f5] border-[rgba(122,90,224,0.35)]",
  },
  mindset: { Ic: Icon.heart, label: "Mindset", cls: "bg-green-soft text-green border-green-border" },
} as const;

export function PrepTip({ tip }: { tip: PrepTipType }) {
  const cat = TIP_CATS[tip.category];
  const Ic = cat.Ic;
  return (
    <div className="grid grid-cols-[26px_1fr] items-start gap-3.5 rounded-md border border-border bg-surface py-[13px] pl-3.5 pr-4">
      <div className={cn("grid size-[26px] shrink-0 place-items-center rounded-[8px] border [&_svg]:size-[13px]", cat.cls)}>
        <Ic />
      </div>
      <div>
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">
          {cat.label}
        </span>
        <div className="text-[13.8px] leading-[1.6] text-fg">{tip.text}</div>
      </div>
    </div>
  );
}

export function Section({
  title,
  count,
  className,
  children,
}: {
  title: string;
  count?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-8", className)}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        {count && (
          <span className="rounded-full border border-border bg-surface-3 px-[9px] py-0.5 text-xs text-fg-3">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
