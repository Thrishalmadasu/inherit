"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui/primitives";
import type { CompanyListItem } from "@/lib/mock/data";

function latest(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days > 365) return "—";
  return `${Math.round(days / 30)}mo ago`;
}

export function CompaniesView({ companies }: { companies: CompanyListItem[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "most">("all");

  const list = useMemo(() => {
    let l = companies.slice();
    const t = q.trim().toLowerCase();
    if (t)
      l = l.filter(
        (c) =>
          c.name.toLowerCase().includes(t) ||
          c.industry.toLowerCase().includes(t),
      );
    if (filter === "most") l = l.sort((a, b) => b.count - a.count);
    return l;
  }, [companies, q, filter]);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-7 pb-20 pt-7">
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">
              Companies
            </h1>
            <p className="text-sm text-fg-2">
              {companies.length} companies have placed SST students or are
              recruiting this cycle.
            </p>
          </div>
          <div className="relative w-80 max-w-full">
            <Icon.search className="pointer-events-none absolute left-[13px] top-1/2 size-[15px] -translate-y-1/2 text-fg-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a company or industry…"
              className="h-10 w-full rounded-md border border-border bg-surface pl-[38px] pr-3 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
            />
          </div>
        </div>

        <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
          <Chip
            label="All"
            count={companies.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <Chip
            label="Most experiences"
            active={filter === "most"}
            onClick={() => setFilter("most")}
          />
        </div>

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              No companies match these filters.
            </strong>
            Try a different search term or clear the filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
            {list.map((c) => (
              <CosTile key={c.slug} co={c} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function CosTile({ co }: { co: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${co.slug}`}
      className="block rounded-lg border border-border bg-surface px-[22px] pb-[18px] pt-5 transition-[border-color,background,transform] hover:border-border-hover hover:bg-surface-3 active:translate-y-[0.5px]"
    >
      <div className="mb-4 flex items-center gap-3.5">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-border-strong bg-bg-2 text-[19px] font-bold tracking-[-0.02em]">
          {co.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[15.5px] font-semibold tracking-[-0.01em]">
            {co.name}
          </div>
          <div className="text-[12.5px] text-fg-3">{co.industry}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3.5">
        <Stat n={String(co.count)} l="Experiences" />
        <Stat n={latest(co.lastDays)} l="Latest" />
      </div>
    </Link>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{n}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.05em] text-fg-3">
        {l}
      </div>
    </div>
  );
}
