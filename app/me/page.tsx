"use client";

import { Fragment, useMemo, useState } from "react";
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
import { myPosts, type MyPost, type ReviewStatus } from "@/lib/mock/data";

const TABS = [
  { id: "all", label: "All" },
  { id: "Draft", label: "Drafts" },
  { id: "Under Review", label: "Under Review" },
  { id: "Approved", label: "Approved" },
  { id: "Needs Edits", label: "Needs Edits" },
  { id: "Hidden", label: "Hidden" },
  { id: "Deleted", label: "Deleted" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_PILL: Record<ReviewStatus, string> = {
  Approved: "text-green bg-green-soft border-green-border",
  "Under Review": "text-blue bg-blue-soft border-blue-border",
  "Needs Edits": "text-amber bg-amber-soft border-amber-border",
  Hidden: "text-red bg-red-soft border-red-border",
  Deleted: "text-fg-3 bg-gray-soft border-gray-border",
};

export default function MyPostsPage() {
  const [tab, setTab] = useState<TabId>("all");
  // Lazy init: read the autosaved draft once on mount (client-only page).
  const [draft, setDraft] = useState<ShareDraft | null>(() => {
    const d = loadDraft();
    return draftTouched(d) ? d : null;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: myPosts.length, Draft: draft ? 1 : 0 };
    for (const p of myPosts) c[p.status] = (c[p.status] || 0) + 1;
    if (draft) c.all += 1;
    return c;
  }, [draft]);

  const list = useMemo(() => {
    if (tab === "Draft") return [];
    if (tab === "all")
      return [
        ...myPosts.filter((p) => p.status !== "Deleted"),
        ...myPosts.filter((p) => p.status === "Deleted"),
      ];
    return myPosts.filter((p) => p.status === tab);
  }, [tab]);

  const showDraft = draft && (tab === "all" || tab === "Draft");
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
            const n = counts[t.id] ?? 0;
            const active = tab === t.id;
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

        {list.length === 0 && !showDraft ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              {tab === "Draft" ? "No drafts right now." : "Nothing here yet."}
            </strong>
            {tab === "Draft"
              ? "When you start a share-experience post and step away, it'll wait for you here."
              : "Posts in this state will appear here once you create some."}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {showDraft && draft && <DraftRow draft={draft} onDiscard={discardDraft} />}
            {list.map((p) => (
              <MyPostRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function MyPostRow({ post }: { post: MyPost }) {
  const rounds = post.rounds ?? [];
  const totalQuestions = rounds.reduce((s, r) => s + (r.questions || 0), 0);

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
            </>
          )}
          {(post.status === "Needs Edits" || post.status === "Hidden") && (
            <SmallButton href={`/share?edit=${post.id}`} variant="primary">
              <Icon.pencil /> Make edits
            </SmallButton>
          )}
          {post.status === "Deleted" && (
            <SmallButton onClick={() => toast("Restore arrives with the database — coming right up")}>
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
