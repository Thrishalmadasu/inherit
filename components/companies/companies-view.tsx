"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import type { CompanyListItem } from "@/lib/types";
import type { Paginated } from "@/lib/db/queries";

function latest(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days > 365) return "-";
  return `${Math.round(days / 30)}mo ago`;
}

// Server-paginated (10/page), ordered by experience count desc. Search + page
// live in the URL (?q & ?page) so the server re-queries — no whole-list load.
export function CompaniesView({
  data,
  q,
  page,
}: {
  data: Paginated<CompanyListItem>;
  q: string;
  page: number;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);

  const navigate = (next: { q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const query = next.q ?? q;
    if (query.trim()) params.set("q", query.trim());
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.push(`/companies${params.toString() ? `?${params}` : ""}`);
  };

  const from = data.total === 0 ? 0 : (page - 1) * 10 + 1;
  const to = (page - 1) * 10 + data.items.length;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-7 pb-20 pt-7">
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">Companies</h1>
            <p className="text-sm text-fg-2">
              {data.total} companies have placed SST students or are recruiting.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: term, page: 1 });
            }}
            className="relative w-80 max-w-full"
          >
            <Icon.search className="pointer-events-none absolute left-[13px] top-1/2 size-[15px] -translate-y-1/2 text-fg-3" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search a company or industry…"
              className="h-10 w-full rounded-md border border-border bg-surface pl-[38px] pr-3 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
            />
          </form>
        </div>

        {data.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              {q ? "No companies match your search." : "No companies yet."}
            </strong>
            {q ? "Try a different term." : "Companies appear as experiences are published."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
            {data.items.map((c) => (
              <CosTile key={c.slug} co={c} />
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-[12.5px] text-fg-3">
          <span>{data.total === 0 ? "No companies" : `Showing ${from}–${to} of ${data.total}`}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 })}
              className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="tabular-nums">Page {page}</span>
            <button
              type="button"
              disabled={!data.hasMore}
              onClick={() => navigate({ page: page + 1 })}
              className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
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
          <div className="mb-0.5 text-[15.5px] font-semibold tracking-[-0.01em]">{co.name}</div>
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
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.05em] text-fg-3">{l}</div>
    </div>
  );
}
