"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { ExperienceCard } from "@/components/ui/experience-card";
import { experiences, avgDifficultyOf, type Experience } from "@/lib/mock/data";

const SEED_H = [42, 28, 16, 11, 7, 4, 31, 19, 23, 9, 14, 6];
const SEED_V = [612, 489, 312, 245, 188, 142, 511, 380, 290, 160, 220, 95];

// Synthesise a richer cross-company set so the filters/sorts feel meaningful.
const VARIANTS: Experience[] = [
  {
    id: "v1", company: "Atlassian", role: "SDE Intern", year: 2026,
    submittedAt: "Apr 18, 2026", overallOutcome: "Offer",
    author: { name: "Riya K.", batch: "'27", anonymous: false }, helpful: 38, views: 540,
    rounds: [
      { round: "OA", status: "Passed", questions: 2, avgDifficulty: 3, platform: "HackerRank" },
      { round: "Tech 1", status: "Passed", questions: 3, avgDifficulty: 4, platform: "Zoom" },
      { round: "Tech 2", status: "Passed", questions: 2, avgDifficulty: 4, platform: "Zoom" },
      { round: "HR", status: "Passed", questions: 0, platform: "Zoom" },
    ],
  },
  {
    id: "v2", company: "Microsoft", role: "SDE Intern", year: 2026,
    submittedAt: "Apr 16, 2026", round: "OA", outcome: "Shortlisted", questions: 3,
    avgDifficulty: 3, platform: "Codility",
    author: { name: null, batch: "'27", anonymous: true }, helpful: 21, views: 410,
  },
  {
    id: "v3", company: "Google", role: "STEP Intern", year: 2026,
    submittedAt: "Apr 12, 2026", overallOutcome: "Rejected",
    author: { name: "Aarav S.", batch: "'27", anonymous: false }, helpful: 12, views: 268,
    rounds: [
      { round: "OA", status: "Passed", questions: 2, avgDifficulty: 4, platform: "Google Hire" },
      { round: "Tech 1", status: "Passed", questions: 2, avgDifficulty: 4, platform: "Google Meet" },
      { round: "Tech 2", status: "Failed", questions: 2, avgDifficulty: 5, platform: "Google Meet" },
    ],
  },
  {
    id: "v4", company: "Razorpay", role: "Backend Intern", year: 2026,
    submittedAt: "Apr 10, 2026", round: "OA", outcome: "Awaiting", questions: 2,
    avgDifficulty: 3, platform: "HackerEarth",
    author: { name: "Nikhil D.", batch: "'27", anonymous: false }, helpful: 8, views: 178,
  },
  {
    id: "v5", company: "Sprinklr", role: "SDE Intern", year: 2026,
    submittedAt: "Apr 06, 2026", round: "Behavioral", outcome: "Offer", questions: 5,
    avgDifficulty: 2, platform: "Zoom",
    author: { name: null, batch: "'27", anonymous: true }, helpful: 17, views: 320,
  },
  {
    id: "v6", company: "Microsoft", role: "SDE Intern", year: 2026,
    submittedAt: "Mar 28, 2026", overallOutcome: "Offer",
    author: { name: "Riya K.", batch: "'27", anonymous: false }, helpful: 26, views: 405,
    rounds: [
      { round: "OA", status: "Passed", questions: 3, avgDifficulty: 3, platform: "Codility" },
      { round: "Tech 1", status: "Passed", questions: 2, avgDifficulty: 4, platform: "Teams" },
      { round: "Tech 2", status: "Passed", questions: 2, avgDifficulty: 4, platform: "Teams" },
    ],
  },
  {
    id: "v7", company: "Walmart Global Tech", role: "SDE Intern", year: 2026,
    submittedAt: "Mar 22, 2026", round: "HR", outcome: "Offer", questions: 4,
    avgDifficulty: 2, platform: "Zoom",
    author: { name: "Nikhil D.", batch: "'27", anonymous: false }, helpful: 5, views: 92,
  },
];

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

export default function FeedPage() {
  const items = useMemo<Experience[]>(
    () => [
      ...experiences.map((e, i) => ({
        ...e,
        company: "Amazon",
        helpful: SEED_H[i % 12],
        views: SEED_V[i % 12],
      })),
      ...VARIANTS,
    ],
    [],
  );
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
