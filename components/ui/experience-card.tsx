import { Fragment } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { OutcomePill, PipeChip } from "@/components/ui/pill";
import { Author, Difficulty, Dot } from "@/components/ui/primitives";
import {
  type Experience,
  outcomeToStatus,
  type RoundStatus,
} from "@/lib/mock/data";

// Unified card for the Company page + All Experiences feed. Accepts either the
// single-round legacy shape (e.round/e.outcome) or the multi-round shape
// (e.rounds[]).
export function ExperienceCard({
  e,
  showCompany = true,
}: {
  e: Experience;
  showCompany?: boolean;
}) {
  const rounds =
    e.rounds && e.rounds.length
      ? e.rounds
      : [
          {
            round: e.round ?? "",
            status: outcomeToStatus(e.outcome) as RoundStatus,
            questions: e.questions ?? 0,
            avgDifficulty: e.avgDifficulty,
            platform: e.platform,
          },
        ];
  const overallOutcome = e.overallOutcome ?? e.outcome ?? "Awaiting";
  const totalQuestions = rounds.reduce((s, r) => s + (r.questions || 0), 0);
  const difficulties = rounds
    .map((r) => r.avgDifficulty)
    .filter((d): d is number => typeof d === "number");
  const avgDifficulty = difficulties.length
    ? Math.round(difficulties.reduce((s, d) => s + d, 0) / difficulties.length)
    : null;
  const platforms = [...new Set(rounds.map((r) => r.platform).filter(Boolean))];
  const company = e.company || "Amazon";

  return (
    <Link
      href={`/experiences/${e.id}`}
      className="group block w-full rounded-lg border border-border bg-surface px-[18px] py-4 text-left transition-[border-color,background] duration-150 hover:border-border-hover hover:bg-surface-3 focus-visible:border-blue-border focus-visible:shadow-[0_0_0_3px_var(--color-blue-soft)] focus-visible:outline-none"
    >
      {/* Head */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {showCompany && (
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="grid size-[22px] shrink-0 place-items-center rounded-sm border border-border bg-bg-2 text-[11px] font-bold text-fg">
              {company[0]}
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-fg">
              {company}
            </span>
            <span className="text-fg-4">·</span>
          </span>
        )}
        <span className="min-w-0 truncate whitespace-nowrap text-sm font-medium text-fg-2">
          {e.role}
        </span>
        <span className="ml-auto whitespace-nowrap pr-1 text-xs text-fg-3">
          {e.submittedAt}
        </span>
        <OutcomePill outcome={overallOutcome} />
      </div>

      {/* Pipeline */}
      <div className="my-[10px] flex flex-wrap items-center gap-1.5">
        {rounds.map((r, i) => (
          <Fragment key={i}>
            <PipeChip status={r.status} size="card">
              {r.round}
            </PipeChip>
            {i < rounds.length - 1 && (
              <Icon.arrow className="size-3 shrink-0 text-fg-4" />
            )}
          </Fragment>
        ))}
      </div>

      {/* Foot */}
      <div className="mt-3 flex items-center gap-4 text-xs text-fg-3">
        <Author author={e.author} />
        <Dot />
        <span className="flex items-center gap-[5px] [&_svg]:size-3 [&_svg]:opacity-70">
          <Icon.list /> {totalQuestions}{" "}
          {totalQuestions === 1 ? "question" : "questions"}
        </span>
        {avgDifficulty != null && (
          <>
            <Dot />
            <span className="flex items-center gap-[5px] [&_svg]:size-3 [&_svg]:opacity-70">
              <Icon.gauge /> Difficulty <Difficulty value={avgDifficulty} />
            </span>
          </>
        )}
        {platforms.length > 0 && (
          <>
            <Dot />
            <span className="flex items-center gap-[5px]">
              {platforms.join(", ")}
            </span>
          </>
        )}
        {(e.helpful != null || e.views != null) && (
          <span className="ml-auto inline-flex items-center gap-3 whitespace-nowrap">
            {e.helpful != null && (
              <span className="inline-flex items-center gap-[5px] tabular-nums text-fg-3 group-hover:text-fg-2 [&_svg]:size-[13px] [&_svg]:opacity-75">
                <Icon.heart /> {e.helpful}
              </span>
            )}
            {e.views != null && (
              <span className="inline-flex items-center gap-[5px] tabular-nums text-fg-3 group-hover:text-fg-2 [&_svg]:size-[13px] [&_svg]:opacity-75">
                <Icon.eye /> {e.views}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
