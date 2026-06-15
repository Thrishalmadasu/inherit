"use client";

// Client half of My Posts: tab filtering, the localStorage draft row, the
// author actions (restore / delete / resubmit), and the Saved tab (bookmarked
// posts by others). Everything arrives as props from the server page - never
// queried here.
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { OutcomePill, PipeChip, Pill, PillDot } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  clearDraft,
  draftTouched,
  loadDraft,
  relativeTime,
  type ShareDraft,
} from "@/lib/draft";
import { deleteMyPost, restoreMyPost, resubmitWithdrawn } from "@/app/actions/my-posts";
import { fetchMyPosts, fetchSavedPage } from "@/app/actions/me";
import { ExperienceCard } from "@/components/ui/experience-card";
import type { MyPostsPage, Paginated } from "@/lib/db/queries";
import type { ActionResult } from "@/lib/write/run";
import type { Experience, MyPost, ReviewStatus } from "@/lib/types";

const TABS = [
  { id: "all", label: "All" },
  { id: "Draft", label: "Drafts" },
  { id: "Under Review", label: "Under Review" },
  { id: "Approved", label: "Approved" },
  { id: "Needs Edits", label: "Needs Edits" },
  { id: "Rejected", label: "Rejected" },
  { id: "Withdrawn", label: "Withdrawn" },
  { id: "Hidden", label: "Hidden" },
  { id: "Deleted", label: "Deleted" },
  { id: "Saved", label: "Saved" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_PILL: Record<ReviewStatus, string> = {
  Approved: "text-green bg-green-soft border-green-border",
  "Under Review": "text-blue bg-blue-soft border-blue-border",
  "Needs Edits": "text-amber bg-amber-soft border-amber-border",
  Rejected: "text-red bg-red-soft border-red-border",
  Withdrawn: "text-fg-3 bg-gray-soft border-gray-border",
  Hidden: "text-red bg-red-soft border-red-border",
  Deleted: "text-fg-3 bg-gray-soft border-gray-border",
};

export function MyPostsView({
  posts,
  saved,
}: {
  posts: MyPostsPage;
  saved: Paginated<Experience>;
}) {
  const [tab, setTab] = useState<TabId>("all");
  // Lazy init: read the autosaved draft once on mount (client-only state).
  const [draft, setDraft] = useState<ShareDraft | null>(() => {
    const d = loadDraft();
    return draftTouched(d) ? d : null;
  });

  // The My Posts list is now server-paginated + searchable (an author can rack
  // up dozens of posts). Page 1 + the tab counts arrive from props; tab/search
  // changes re-query page 1, "Load more" appends the next page.
  const [q, setQ] = useState("");
  const term = q.trim();
  const [items, setItems] = useState<MyPost[]>(posts.items);
  const [total, setTotal] = useState(posts.total);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(posts.hasMore);
  const [counts, setCounts] = useState(posts.counts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refetching, startRefetch] = useTransition();
  const reqId = useRef(0);
  const didMount = useRef(false);

  // Draft and Saved tabs don't hit the posts query (Draft is a local autosave,
  // Saved is its own paginated read below).
  const statusParam: ReviewStatus | "all" | null =
    tab === "all" ? "all" : tab === "Draft" || tab === "Saved" ? null : (tab as ReviewStatus);

  // Re-query page 1 whenever the tab or search term changes (skip the first
  // render - the server already provided page 1 of "all").
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (statusParam === null) return;
    const id = ++reqId.current;
    startRefetch(async () => {
      const res = await fetchMyPosts({ status: statusParam, search: term, page: 1 });
      if (id !== reqId.current) return; // a newer request superseded this one
      setItems(res.items);
      setTotal(res.total);
      setPage(1);
      setHasMore(res.hasMore);
      setCounts(res.counts);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, term]);

  const loadMore = async () => {
    if (statusParam === null) return;
    setLoadingMore(true);
    const id = ++reqId.current;
    try {
      const res = await fetchMyPosts({ status: statusParam, search: term, page: page + 1 });
      if (id !== reqId.current) return;
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage((p) => p + 1);
      setHasMore(res.hasMore);
      setCounts(res.counts);
    } catch {
      toast("Couldn't load more - please try again");
    } finally {
      setLoadingMore(false);
    }
  };

  // Saved is the other growing list. Page 1 from props; "Load more" accumulates.
  const [savedExtra, setSavedExtra] = useState<Experience[]>([]);
  const [savedNextPage, setSavedNextPage] = useState(2);
  const [savedHasMore, setSavedHasMore] = useState(saved.hasMore);
  const [savedLoading, setSavedLoading] = useState(false);
  const savedItems = useMemo(() => [...saved.items, ...savedExtra], [saved.items, savedExtra]);
  const loadMoreSaved = async () => {
    setSavedLoading(true);
    try {
      const res = await fetchSavedPage({ page: savedNextPage });
      setSavedExtra((p) => [...p, ...res.items]);
      setSavedHasMore(res.hasMore);
      setSavedNextPage((n) => n + 1);
    } catch {
      toast("Couldn't load more - please try again");
    } finally {
      setSavedLoading(false);
    }
  };

  // The local draft counts toward All/Draft, but only when not searching (it
  // isn't part of the server's search results).
  const draftCount = draft && !term ? 1 : 0;
  const tabCount = (id: TabId): number => {
    if (id === "all") return counts.all + draftCount;
    if (id === "Draft") return draftCount;
    if (id === "Saved") return saved.total;
    return counts[id as ReviewStatus] ?? 0;
  };

  const showDraft = !!draft && !term && (tab === "all" || tab === "Draft");
  const searchable = tab !== "Saved" && tab !== "Draft";
  const discardDraft = () => {
    if (!confirm("Discard this draft? This can't be undone.")) return;
    clearDraft();
    setDraft(null);
    toast("Draft discarded");
  };

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1080px] px-7 pb-20 pt-7">
        <div className="mb-[22px]">
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">My posts</h1>
          <p className="text-sm text-fg-2">
            Everything you&apos;ve submitted to Inherit, grouped by state.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-[18px] flex gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1">
          {TABS.map((t) => {
            const n = tabCount(t.id);
            const active = tab === t.id;
            if (n === 0 && t.id !== tab && t.id !== "all" && t.id !== "Draft" && t.id !== "Under Review" && t.id !== "Approved" && t.id !== "Saved")
              return null; // edge-state tabs (Rejected/Withdrawn/Hidden/Deleted) appear only when non-empty (or currently selected)
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-[7px] px-3.5 py-2 text-[13px] font-medium transition-[background,color]",
                  active
                    ? "bg-bg-2 text-fg shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
                    : "text-fg-2 hover:bg-bg-2 hover:text-fg",
                )}
              >
                {t.label}
                {n > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-px text-[11px] tabular-nums",
                      t.id === "Deleted"
                        ? "bg-[rgba(239,90,90,0.1)] text-red"
                        : active
                          ? "bg-blue-soft text-blue"
                          : "bg-surface-3 text-fg-3",
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search (My Posts list only - Saved/Draft are separate surfaces) */}
        {searchable && (
          <div className="relative mb-3.5">
            <Icon.search className="pointer-events-none absolute left-[15px] top-1/2 size-4 -translate-y-1/2 text-fg-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your posts by company, role, or round…"
              className="h-11 w-full rounded-lg border border-border-strong bg-surface pl-[42px] pr-10 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_4px_var(--color-blue-soft)]"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                title="Clear"
                className="absolute right-2.5 top-1/2 grid size-[26px] -translate-y-1/2 place-items-center rounded-full bg-bg-2 text-fg-3 hover:text-fg"
              >
                <Icon.x className="size-3" />
              </button>
            )}
          </div>
        )}

        {tab === "Saved" ? (
          savedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
              <strong className="mb-1.5 block font-semibold text-fg">
                Nothing saved yet.
              </strong>
              Hit Save on any experience and it&apos;ll be waiting here when you
              prep for that company.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {savedItems.map((e) => (
                  <ExperienceCard key={e.id} e={e} showCompany />
                ))}
              </div>
              {savedHasMore && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreSaved}
                    disabled={savedLoading}
                    className="h-9 rounded-md border border-border bg-surface px-5 text-[13px] font-medium text-fg-2 hover:bg-surface-3 disabled:opacity-50"
                  >
                    {savedLoading
                      ? "Loading…"
                      : `Load more (${savedItems.length} of ${saved.total})`}
                  </button>
                </div>
              )}
            </>
          )
        ) : items.length === 0 && !showDraft ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            {refetching ? (
              <strong className="block font-semibold text-fg">Searching…</strong>
            ) : term ? (
              <>
                <strong className="mb-1.5 block font-semibold text-fg">
                  No posts match &ldquo;{q}&rdquo;.
                </strong>
                Try a different company, role, or round - or clear the search.
              </>
            ) : (
              <>
                <strong className="mb-1.5 block font-semibold text-fg">
                  {tab === "Draft" ? "No drafts right now." : "Nothing here yet."}
                </strong>
                {tab === "Draft"
                  ? "When you start a share-experience post and step away, it'll wait for you here."
                  : "Posts in this state will appear here once you create some."}
              </>
            )}
          </div>
        ) : (
          <>
            <div className={cn("flex flex-col gap-2.5", refetching && "opacity-60")}>
              {showDraft && draft && <DraftRow draft={draft} onDiscard={discardDraft} />}
              {items.map((p) => (
                <MyPostRow key={p.id} post={p} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore || refetching}
                  className="h-9 rounded-md border border-border bg-surface px-5 text-[13px] font-medium text-fg-2 hover:bg-surface-3 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load more (${items.length} of ${total})`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function MyPostRow({ post }: { post: MyPost }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const rounds = post.rounds ?? [];
  const totalQuestions = rounds.reduce((s, r) => s + (r.questions || 0), 0);

  const run = (fn: () => Promise<ActionResult>, doneMsg: string) => async () => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    toast(doneMsg);
    router.refresh();
  };

  const onDelete = () => {
    if (!confirm("Delete this post? It disappears from the platform but you can restore it from the Deleted tab any time."))
      return;
    void run(() => deleteMyPost(post.id), "Post deleted - restore it any time")();
  };

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-4 rounded-lg border border-border bg-surface px-[18px] py-4 transition-colors hover:border-border-hover">
      <div className="grid size-11 place-items-center rounded-[11px] border border-border-strong bg-bg-2 text-base font-bold tracking-[-0.02em]">
        {post.company[0]}
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[15px] font-semibold tracking-[-0.005em]">
            {post.role} at {post.company}
          </h3>
          <OutcomePill outcome={post.overallOutcome} />
        </div>

        {rounds.length > 0 && (
          <div className="my-1.5 flex flex-wrap items-center gap-1.5">
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
        )}

        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
          <MetaItem icon={<Icon.clock />}>Submitted {post.submittedAt}</MetaItem>
          {post.updatedAt && post.updatedAt !== post.submittedAt && (
            <>
              <Dot />
              <MetaItem icon={<Icon.pencil />}>Updated {post.updatedAt}</MetaItem>
            </>
          )}
          {totalQuestions > 0 && (
            <>
              <Dot />
              <MetaItem icon={<Icon.list />}>
                {totalQuestions} {totalQuestions === 1 ? "question" : "questions"}
              </MetaItem>
            </>
          )}
          {post.tips > 0 && (
            <>
              <Dot />
              <MetaItem icon={<Icon.bolt />}>
                {post.tips} {post.tips === 1 ? "tip" : "tips"}
              </MetaItem>
            </>
          )}
          {post.deletedAt && (
            <>
              <Dot />
              <span className="text-red">Deleted {post.deletedAt}</span>
            </>
          )}
        </div>

        {post.status === "Needs Edits" && post.opsNote && (
          <OpsNote tone="amber" from="Placement Ops · suggested edit">
            {post.opsNote}
          </OpsNote>
        )}
        {post.status === "Rejected" && post.opsNote && (
          <OpsNote tone="red" from="Placement Ops · rejection reason">
            {post.opsNote} You can edit and resubmit a corrected version.
          </OpsNote>
        )}
        {post.status === "Hidden" && post.hiddenReason && (
          <OpsNote tone="red" from={`Hidden by Placement Ops${post.hiddenAt ? ` · ${post.hiddenAt}` : ""}`}>
            {post.hiddenReason} Edit and resubmit to send it back through review.
          </OpsNote>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 text-right">
        <Pill className={STATUS_PILL[post.status]}>
          <PillDot />
          {post.status}
        </Pill>

        {post.status === "Approved" && (
          <div className="flex gap-3">
            <Stat icon={<Icon.heart />} n={post.helpful ?? 0} />
            <Stat icon={<Icon.eye />} n={post.views ?? 0} />
          </div>
        )}

        <div className="flex gap-1.5 [&_.btn-sm]:h-[30px]">
          {post.status === "Under Review" && (
            <>
              <SmallButton href="/under-review">View</SmallButton>
              <SmallButton href={`/share?edit=${post.id}`}>
                <Icon.pencil /> Edit
              </SmallButton>
            </>
          )}
          {post.status === "Approved" && (
            <>
              <SmallButton href={`/experiences/${post.id}`}>View</SmallButton>
              <SmallButton href={`/share?edit=${post.id}`}>
                <Icon.pencil /> Edit
              </SmallButton>
              <SmallButton onClick={onDelete} disabled={busy}>
                Delete
              </SmallButton>
            </>
          )}
          {(post.status === "Needs Edits" ||
            post.status === "Hidden" ||
            post.status === "Rejected") && (
            <SmallButton href={`/share?edit=${post.id}`} variant="primary">
              <Icon.pencil /> Make edits
            </SmallButton>
          )}
          {post.status === "Withdrawn" && (
            <>
              <SmallButton
                onClick={run(
                  () => resubmitWithdrawn(post.id),
                  "Resubmitted - back of the review queue",
                )}
                disabled={busy}
                variant="primary"
              >
                Resubmit
              </SmallButton>
              <SmallButton href={`/share?edit=${post.id}`}>
                <Icon.pencil /> Edit
              </SmallButton>
            </>
          )}
          {post.status === "Deleted" && (
            <SmallButton
              onClick={run(() => restoreMyPost(post.id), "Post restored")}
              disabled={busy}
            >
              Restore
            </SmallButton>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({ draft, onDiscard }: { draft: ShareDraft; onDiscard: () => void }) {
  const f = draft.form;
  const detailed = (f.rounds ?? []).filter((r) => r.detailed).length;
  const totalRounds = (f.rounds ?? []).length;
  const tipsCount = (f.tips ?? []).filter((t) => t.text?.trim()).length;

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-4 rounded-lg border border-dashed border-border-strong bg-surface px-[18px] py-4">
      <div className="grid size-11 place-items-center rounded-[11px] border border-border-strong bg-bg-2 text-base font-bold tracking-[-0.02em]">
        {(f.company || "?")[0]}
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-[15px] font-semibold tracking-[-0.005em]">
            {f.role || "Untitled draft"}
            {f.company ? ` at ${f.company}` : ""}
          </h3>
          <Pill tone="amber">
            <PillDot />
            Draft
          </Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
          <span>Last edited {relativeTime(draft.savedAt)}</span>
          {totalRounds > 0 && (
            <>
              <Dot />
              <span>
                {totalRounds} round{totalRounds === 1 ? "" : "s"}
                {detailed > 0 && ` · ${detailed} detailed`}
              </span>
            </>
          )}
          {tipsCount > 0 && (
            <>
              <Dot />
              <span>
                {tipsCount} tip{tipsCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          {f.reflection?.trim() && (
            <>
              <Dot />
              <span>Reflection started</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <SmallButton href="/share" variant="primary">
          Continue
        </SmallButton>
        <SmallButton onClick={onDiscard}>Discard</SmallButton>
      </div>
    </div>
  );
}

// ── tiny locals ──────────────────────────────────────────────────────────────
function Dot() {
  return <span className="size-[3px] rounded-full bg-fg-4" />;
}

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:opacity-70">
      {icon}
      {children}
    </span>
  );
}

function Stat({ icon, n }: { icon: React.ReactNode; n: number }) {
  return (
    <span className="inline-flex items-center gap-[5px] text-xs text-fg-3 [&_svg]:size-[13px] [&_svg]:opacity-75">
      {icon} <b className="font-semibold tabular-nums text-fg">{n}</b>
    </span>
  );
}

function OpsNote({
  tone,
  from,
  children,
}: {
  tone: "amber" | "red";
  from: string;
  children: React.ReactNode;
}) {
  const tones = {
    amber: { box: "bg-amber-soft border-amber-border", icon: "text-amber border-amber-border", from: "text-amber" },
    red: { box: "bg-red-soft border-red-border", icon: "text-red border-red-border", from: "text-red" },
  }[tone];
  return (
    <div className={cn("mt-3 flex gap-2.5 rounded-md border px-[13px] py-[11px] text-[13px] leading-[1.55] text-fg", tones.box)}>
      <div className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-full border", tones.icon)}>
        <Icon.info className="size-[11px]" />
      </div>
      <div>
        <div className={cn("mb-[3px] text-[11px] font-semibold uppercase tracking-[0.06em]", tones.from)}>
          {from}
        </div>
        {children}
      </div>
    </div>
  );
}

function SmallButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn("h-[30px] px-2.5 text-[12.5px]", className)}
    />
  );
}
