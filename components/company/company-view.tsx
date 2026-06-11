"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { TopicsList } from "@/components/ui/topics-list";
import { Select } from "@/components/ui/select";
import { ExperienceCard } from "@/components/ui/experience-card";
import { company, experiences, avgDifficultyOf } from "@/lib/mock/data";

export function CompanyView() {
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [roundFilter, setRoundFilter] = useState("All rounds");
  const [sort, setSort] = useState("recent");

  const roles = useMemo(
    () => ["All roles", ...new Set(experiences.map((e) => e.role))],
    [],
  );
  const rounds = useMemo(
    () => [
      "All rounds",
      ...Object.keys(company.breakdown).filter((k) => company.breakdown[k] > 0),
    ],
    [],
  );

  const filtered = useMemo(() => {
    let list = experiences.slice();
    if (roleFilter !== "All roles") list = list.filter((e) => e.role === roleFilter);
    if (roundFilter !== "All rounds")
      list = list.filter((e) => {
        const rs = e.rounds ? e.rounds.map((r) => r.round) : [e.round];
        return rs.includes(roundFilter);
      });
    if (sort === "difficulty")
      list = list.sort((a, b) => avgDifficultyOf(b) - avgDifficultyOf(a));
    else if (sort === "helpful")
      list = list.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
    else if (sort === "views")
      list = list.sort((a, b) => (b.views || 0) - (a.views || 0));
    return list;
  }, [roleFilter, roundFilter, sort]);

  const totalBeh = (company.breakdown.Behavioral || 0) + (company.breakdown.HR || 0);
  const totalTech =
    (company.breakdown["Tech 1"] || 0) +
    (company.breakdown["Tech 2"] || 0) +
    (company.breakdown["System Design"] || 0);
  const rolesMax = Math.max(...company.roles.map((r) => r.count));
  const filtersActive = roleFilter !== "All roles" || roundFilter !== "All rounds";

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-7 pb-20 pt-7">
        {/* Breadcrumb */}
        <div className="mb-[18px] flex items-center gap-2 text-[13px] text-fg-3">
          <Link href="/companies" className="hover:text-fg">
            Companies
          </Link>
          <Icon.chev className="size-3 opacity-60" />
          <span className="text-fg">{company.name}</span>
        </div>

        {/* Header */}
        <header className="mb-7 flex items-start gap-[22px] border-b border-border px-1 pb-7 pt-[22px]">
          <div className="grid size-[76px] shrink-0 place-items-center rounded-2xl border border-border-strong bg-surface bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent)] text-[26px] font-bold tracking-[-0.02em]">
            {company.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[30px] font-bold tracking-[-0.025em]">
              {company.name}
            </h1>
            <div className="mt-1.5 text-sm text-fg-2">{company.industry}</div>
            <div className="mt-3.5 flex flex-wrap items-center gap-3.5 text-[13px] text-fg-3">
              <span className="inline-flex items-center gap-[5px]">
                <Icon.pin className="size-3" /> {company.location}
              </span>
              <span className="size-[3px] rounded-full bg-fg-4" />
              <span>{company.roles.map((r) => r.name).join(" · ")}</span>
              <span className="size-[3px] rounded-full bg-fg-4" />
              <span>Last submission 2 days ago</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button href="/share" variant="primary">
              <Icon.plus /> Share {company.name} experience
            </Button>
          </div>
        </header>

        {/* Stat cards */}
        <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Experiences"
            icon={Icon.list}
            value={company.totalExperiences}
            sub={`Across ${company.years.length} placement cycles`}
          />
          <StatCard
            label="Online Assessment"
            icon={Icon.code}
            value={company.breakdown.OA}
            sub="Latest from 2 days ago"
          />
          <StatCard
            label="Technical rounds"
            icon={Icon.layers}
            value={totalTech}
            sub="Tech 1, Tech 2, System Design"
          />
          <StatCard
            label="Behavioural & HR"
            icon={Icon.users}
            value={totalBeh}
            sub="Leadership Principles heavy"
          />
        </div>

        {/* Roles + topics */}
        <div className="mb-7 grid gap-3.5 md:grid-cols-[1.2fr_1fr]">
          <Panel title={`Roles at ${company.name}`} hint={`${company.roles.length} roles · all cycles`}>
            <div className="flex flex-col gap-0.5">
              {company.roles.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-[minmax(120px,1fr)_2fr_auto] items-center gap-3.5 px-1 py-1.5 text-fg-2"
                >
                  <span className="truncate text-[13px] font-medium">{r.name}</span>
                  <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-bg-2">
                    <span
                      className="block h-full rounded-[3px] bg-gradient-to-r from-blue to-[#56b6fb]"
                      style={{ width: `${(r.count / rolesMax) * 100}%` }}
                    />
                  </span>
                  <span className="min-w-[22px] text-right text-[13px] font-semibold tabular-nums text-fg">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Top topics across rounds" hint="Across all roles">
            <TopicsList topics={company.topTopics} />
            <div className="mt-3.5 border-t border-dashed border-border pt-3 text-[11.5px] text-fg-3">
              Tagged by submitters in their question topics.
            </div>
          </Panel>
        </div>

        {/* Filter bar */}
        <div className="my-[18px] flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-surface px-4 py-3.5">
          <label className="relative inline-flex items-center gap-2">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
              Role
            </span>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </label>
          <label className="relative inline-flex items-center gap-2">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
              Round
            </span>
            <Select value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}>
              {rounds.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </label>
          {filtersActive && (
            <button
              onClick={() => {
                setRoleFilter("All roles");
                setRoundFilter("All rounds");
              }}
              className="border-0 bg-transparent px-2 text-[12.5px] text-fg-3 hover:text-fg"
            >
              Clear all
            </button>
          )}
        </div>

        {/* List */}
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-[-0.01em]">
            {filtered.length} {filtered.length === 1 ? "experience" : "experiences"}
          </h2>
          <div className="inline-flex items-center gap-2.5 text-[13px] font-medium text-fg-3">
            Sort
            <Select variant="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="helpful">Most helpful</option>
              <option value="views">Most viewed</option>
              <option value="difficulty">Hardest first</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              No experiences match these filters.
            </strong>
            Try clearing a filter — or be the first to share for this slice.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((e) => (
              <ExperienceCard key={e.id} e={e} showCompany={false} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 pb-5 pt-[18px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] font-semibold tracking-[-0.005em] text-fg">
          {title}
        </div>
        <div className="text-[11.5px] text-fg-3">{hint}</div>
      </div>
      {children}
    </div>
  );
}
