import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";
import type { Outcome, RoundStatus } from "@/lib/types";

// ─── Base pill ─────────────────────────────────────────────────────────────
const PILL_BASE =
  "inline-flex items-center gap-[5px] h-[22px] px-2.5 rounded-full border text-[11.5px] font-medium tracking-[0.01em] whitespace-nowrap";

export type PillTone = "neutral" | "green" | "blue" | "amber" | "red";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "border-gray-border bg-gray-soft text-fg-2",
  green:
    "text-green bg-green-soft border-green-border shadow-[0_0_12px_-4px_rgba(46,207,133,0.4)]",
  blue: "text-blue bg-blue-soft border-blue-border shadow-[0_0_12px_-4px_var(--color-blue-glow)]",
  amber: "text-amber bg-amber-soft border-amber-border",
  red: "text-red bg-red-soft border-red-border",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn(PILL_BASE, PILL_TONE[tone], className)}>{children}</span>;
}

export function PillDot() {
  return <span className="size-1.5 rounded-full bg-current" />;
}

// ─── Outcome pill ──────────────────────────────────────────────────────────
const OUTCOME_TONE: Record<Outcome, PillTone> = {
  Offer: "green",
  Shortlisted: "blue",
  Awaiting: "neutral",
  Rejected: "red",
  Withdrew: "neutral",
};

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  return (
    <Pill tone={OUTCOME_TONE[outcome]}>
      <PillDot />
      {outcome}
    </Pill>
  );
}

// ─── Round pill (neutral, leading icon by type) ────────────────────────────
const ROUND_ICON: Record<string, (p: { className?: string }) => ReactNode> = {
  OA: Icon.code,
  "Tech 1": Icon.layers,
  "Tech 2": Icon.layers,
  "System Design": Icon.layers,
  Behavioral: Icon.users,
  HR: Icon.users,
};

export function RoundPill({ round }: { round: string }) {
  const Ic = ROUND_ICON[round] ?? Icon.list;
  return (
    <Pill>
      <Ic className="size-[11px]" />
      {round}
    </Pill>
  );
}

// ─── Pipeline chip (per-round status on cards / editors) ───────────────────
const PIPE_BASE =
  "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap";

const PIPE_STATUS: Record<RoundStatus, string> = {
  Passed: "text-green bg-green-soft border-green-border",
  Failed: "text-red bg-red-soft border-red-border",
  Awaiting: "text-amber bg-amber-soft border-amber-border",
};

export function PipeChip({
  status,
  size = "card",
  dashed = false,
  children,
}: {
  status?: RoundStatus;
  size?: "card" | "default";
  dashed?: boolean;
  children: ReactNode;
}) {
  const sizing =
    size === "card"
      ? "text-[11px] px-[9px] py-[3px]"
      : "text-xs px-3 py-1.5";
  return (
    <span
      className={cn(
        PIPE_BASE,
        sizing,
        status
          ? PIPE_STATUS[status]
          : "border-border bg-bg-2 text-fg-2",
        dashed ? "border-dashed" : "border-solid",
      )}
    >
      {children}
    </span>
  );
}
