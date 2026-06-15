"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TopNav } from "@/components/top-nav";
import { Chip } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { ExperienceCard } from "@/components/ui/experience-card";
import { fetchFeedPage } from "@/app/actions/feed";
import type { FeedPage, FeedSort } from "@/lib/db/queries";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { Experience } from "@/lib/types";

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

export function FeedView({ initial }: { initial: FeedPage }) {
  const [round, setRound] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [sort, setSort] = useState<FeedSort>("latest");

  const [list, setList] = useState<Experience[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refetching, startRefetch] = useTransition();

  // Ignore out-of-order responses when filters change rapidly.
  const reqId = useRef(0);
  const didMount = useRef(false);

  // Re-query page 1 from the server whenever a filter/sort changes (skip the
  // initial render - the server already provided page 1).
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const id = ++reqId.current;
    startRefetch(async () => {
      const res = await fetchFeedPage({ round, outcome, sort, page: 1 });
      if (id !== reqId.current) return; // a newer request superseded this one
      setList(res.items);
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
    });
  }, [round, outcome, sort]);

  const loadMore = async () => {
    setLoadingMore(true);
    const id = ++reqId.current;
    try {
      const res = await fetchFeedPage({ round, outcome, sort, page: page + 1 });
      if (id !== reqId.current) return;
      setList((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch {
      toast("Couldn't load more - please try again");
    } finally {
      setLoadingMore(false);
    }
  };

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
            {total} {total === 1 ? "experience" : "experiences"}
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
            <Select
              variant="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as FeedSort)}
            >
              <option value="latest">Latest first</option>
              <option value="helpful">Most helpful</option>
              <option value="views">Most viewed</option>
            </Select>
          </div>
        </div>

        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              No experiences match these filters.
            </strong>
            Try clearing a filter to see more.
          </div>
        ) : (
          <div className={cn("flex flex-col gap-2.5", refetching && "opacity-60")}>
            {list.map((e) => (
              <ExperienceCard key={e.id} e={e} showCompany />
            ))}
          </div>
        )}

        {hasMore && total > 0 && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore || refetching}
              className="h-9 rounded-md border border-border bg-surface px-5 text-[13px] font-medium text-fg-2 hover:bg-surface-3 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Load more (${list.length} of ${total})`}
            </button>
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
