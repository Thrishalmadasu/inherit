"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { ExperienceCard } from "@/components/ui/experience-card";
import { avgDifficultyOf, type Experience } from "@/lib/types";

const ROUND_FILTERS = [
  { id: "all", label: "All rounds" },
  { id: "OA", label: "OA" },
  { id: "Tech", label: "Tech" },
  { id: "System Design", label: "System Design" },
  { id: "Behavioral", label: "Behavioural" },
  { id: "HR", label: "HR" },
];
const OUTCOME_FILTERS = [
  { id: "all", label: "Any outcome" },
  { id: "Offer", label: "Offer" },
  { id: "Shortlisted", label: "Shortlisted" },
  { id: "Awaiting", label: "Awaiting" },
  { id: "Rejected", label: "Rejected" },
];

export function FeedView({ items }: { items: Experience[] }) {
  const [round, setRound] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [sort, setSort] = useState("latest");

  const list = useMemo(() => {
    let l = items.slice();
    if (round !== "all") {
      l = l.filter((item) => {
        const rs = item.rounds ? item.rounds.map((r) => r.round) : [item.round];
        if (round === "Tech") return rs.some((r) => r && r.startsWith("Tech"));
        return rs.includes(round);
      });
    }
    if (outcome !== "all")
      l = l.filter((i) => (i.overallOutcome || i.outcome) === outcome);
    if (sort === "helpful") l = l.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
    else if (sort === "views") l = l.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sort === "difficulty")
      l = l.sort((a, b) => avgDifficultyOf(b) - avgDifficultyOf(a));
    return l;
  }, [items, round, outcome, sort]);

  const activeFilters = (round !== "all" ? 1 : 0) + (outcome !== "all" ? 1 : 0);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[880px] px-7 pb-20 pt-7">
        <div className="mb-5">
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">
            All experiences
          </h1>
          <p className="text-sm text-fg-2">
            Every approved experience your batchmates have shared.
          </p>
        </div>

        <div className="mb-3.5 flex flex-col gap-2.5 rounded-lg border border-border bg-surface px-[18px] py-4">
          <FilterGroup label="Round">
            {ROUND_FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} active={round === f.id} onClick={() => setRound(f.id)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Outcome">
            {OUTCOME_FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} active={outcome === f.id} onClick={() => setOutcome(f.id)} />
            ))}
          </FilterGroup>
        </div>

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <span className="inline-flex items-center gap-3 text-sm font-medium text-fg">
            {list.length} {list.length === 1 ? "experience" : "experiences"}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setRound("all");
                  setOutcome("all");
                }}
                className="border-0 bg-transparent px-2 text-[12.5px] text-fg-3 hover:text-fg"
              >
                Clear filters
              </button>
            )}
          </span>
          <div className="inline-flex items-center gap-2.5 text-[13px] font-medium text-fg-3">
            Sort
            <Select variant="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="latest">Latest first</option>
              <option value="helpful">Most helpful</option>
              <option value="views">Most viewed</option>
              <option value="difficulty">Hardest first</option>
            </Select>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              No experiences match these filters.
            </strong>
            Try clearing one — there are {items.length} experiences in total.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {list.map((e) => (
              <ExperienceCard key={e.id} e={e} showCompany />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
        {label}
      </span>
      {children}
    </div>
  );
}
