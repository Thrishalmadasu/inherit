"use client";

// Client half of the Ops moderation queue (PRD §7 Flow E). Data arrives as
// props; every button calls a real Server Action. Reason discipline is
// enforced here too: Suggest edits / Reject / Hide all demand a note before
// the confirm button enables (the action layer re-checks).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { OutcomePill, Pill, RoundPill } from "@/components/ui/pill";
import { Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  approveExperience,
  hideExperience,
  rejectExperience,
  resolveExperienceCompany,
  suggestEdits,
  unhideExperience,
} from "@/app/actions/moderation";
import { fetchOpsPublished, fetchOpsQueue, searchCompaniesForResolve } from "@/app/actions/ops";
import type { CompanyResolution } from "@/lib/write/moderation";
import type { Paginated } from "@/lib/db/queries";
import type { ActionResult } from "@/lib/write/run";
import type { OpsPublishedItem, OpsQueueItem } from "@/lib/types";

type View = "all" | "anonymous" | "published";

// Page-1 lives in props (always fresh after router.refresh); "Load more"
// accumulates further pages in `extra`. On a mutation we reset() + refresh, so
// stale older pages never linger.
function usePaged<T extends { id: string }>(
  initial: Paginated<T>,
  fetchPage: (page: number) => Promise<Paginated<T>>,
) {
  const [extra, setExtra] = useState<T[]>([]);
  const [nextPage, setNextPage] = useState(2);
  const [moreHasMore, setMoreHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const items = useMemo(() => [...initial.items, ...extra], [initial.items, extra]);
  const hasMore = extra.length === 0 ? initial.hasMore : moreHasMore;

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetchPage(nextPage);
      setExtra((p) => [...p, ...res.items]);
      setMoreHasMore(res.hasMore);
      setNextPage((n) => n + 1);
    } catch {
      toast("Couldn't load more - please try again");
    } finally {
      setLoading(false);
    }
  };
  const reset = () => {
    setExtra([]);
    setNextPage(2);
    setMoreHasMore(false);
  };
  return { items, total: initial.total, hasMore, loading, loadMore, reset };
}

export function OpsQueueView({
  queue,
  anonymous,
  published,
  canModerate,
}: {
  queue: Paginated<OpsQueueItem>;
  anonymous: Paginated<OpsQueueItem>;
  published: Paginated<OpsPublishedItem>;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [hideTarget, setHideTarget] = useState<OpsPublishedItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const allList = usePaged(queue, (page) => fetchOpsQueue({ page }));
  const anonList = usePaged(anonymous, (page) => fetchOpsQueue({ anonymousOnly: true, page }));
  const pubList = usePaged(published, (page) => fetchOpsPublished({ page }));

  const counts = { all: allList.total, anonymous: anonList.total, published: pubList.total };
  const queueList = view === "anonymous" ? anonList : allList;
  const active = view === "published" ? pubList : queueList;

  const run = async (id: string, fn: () => Promise<ActionResult>, doneMsg: string) => {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (!result.ok) {
      toast(result.error);
      return false;
    }
    toast(doneMsg);
    allList.reset();
    anonList.reset();
    pubList.reset();
    router.refresh();
    return true;
  };

  const resolveCompany = async (id: string, resolution: CompanyResolution): Promise<boolean> => {
    setBusyId(id);
    const res = await resolveExperienceCompany(id, resolution);
    setBusyId(null);
    if (!res.ok) {
      toast(res.error);
      return false;
    }
    toast(`Company set to ${res.data.companyName}`);
    allList.reset();
    anonList.reset();
    pubList.reset();
    router.refresh();
    return true;
  };

  const oldest = allList.items[0];

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
          View
        </span>
        <Chip label="All pending" count={counts.all} active={view === "all"} onClick={() => setView("all")} />
        <Chip
          label="Anonymous bylines"
          count={counts.anonymous}
          active={view === "anonymous"}
          onClick={() => setView("anonymous")}
        />
        <Chip
          label="Published"
          count={counts.published}
          active={view === "published"}
          onClick={() => setView("published")}
        />
        <span className="ml-auto text-[12.5px] text-fg-3">
          {oldest ? `Oldest pending ${oldest.submittedAgo}` : "Queue clear"} · review
          target 24h · FIFO
        </span>
      </div>

      {view !== "published" ? (
        queueList.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">Queue is clear.</strong>
            New submissions will appear here as they come in.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {queueList.items.map((q) => (
              <ModCard
                key={q.id}
                item={q}
                busy={busyId === q.id}
                run={run}
                resolveCompany={resolveCompany}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2.5">
          {pubList.items.map((e) => (
            <PublishedRow
              key={e.id}
              item={e}
              busy={busyId === e.id}
              canModerate={canModerate}
              onHide={() => setHideTarget(e)}
              onUnhide={() =>
                run(e.id, () => unhideExperience(e.id), "Post is live again (unhide logged)")
              }
            />
          ))}
        </div>
      )}

      {active.hasMore && active.items.length > 0 && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={active.loadMore}
            disabled={active.loading}
            className="h-9 rounded-md border border-border bg-surface px-5 text-[13px] font-medium text-fg-2 hover:bg-surface-3 disabled:opacity-50"
          >
            {active.loading ? "Loading…" : `Load more (${active.items.length} of ${active.total})`}
          </button>
        </div>
      )}

      <HideModal
        target={hideTarget}
        busy={hideTarget != null && busyId === hideTarget.id}
        onConfirm={async (reason) => {
          if (!hideTarget) return;
          const ok = await run(
            hideTarget.id,
            () => hideExperience(hideTarget.id, reason),
            "Post hidden - the author has been notified with your reason",
          );
          if (ok) setHideTarget(null);
        }}
        onClose={() => setHideTarget(null)}
      />
    </>
  );
}

type RunFn = (id: string, fn: () => Promise<ActionResult>, doneMsg: string) => Promise<boolean>;
type ResolveFn = (id: string, resolution: CompanyResolution) => Promise<boolean>;

function ModCard({
  item,
  busy,
  run,
  resolveCompany,
}: {
  item: OpsQueueItem;
  busy: boolean;
  run: RunFn;
  resolveCompany: ResolveFn;
}) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<"reject" | "edits" | null>(null);
  const unresolved = Boolean(item.proposedCompany);

  const initials = item.realAuthor.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-lg border border-border bg-surface px-[18px] py-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <RoundPill round={item.round} />
          <OutcomePill outcome={item.outcome} />
          <Pill>
            <Icon.building className="size-[11px]" /> {item.company}
          </Pill>
        </div>
        <span className="ml-auto whitespace-nowrap text-xs text-fg-3">
          {item.submittedAgo}
        </span>
      </div>

      <h3 className="my-1 text-[15.5px] font-semibold tracking-[-0.005em]">
        {item.role} · {item.round} at {item.company}
      </h3>

      <div className="mb-3 flex items-center gap-2.5 rounded-md border border-border bg-bg-2 px-3 py-2.5">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-xs font-semibold text-white">
          {initials}
        </span>
        <div>
          <div className="text-[13px] font-semibold tracking-[-0.005em]">
            {item.realAuthor.name}
          </div>
          <div className="mt-px text-[11.5px] text-fg-3">{item.realAuthor.email}</div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">
          Byline
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] normal-case tracking-normal",
              item.bylineAs === "anonymous"
                ? "border-amber-border bg-amber-soft text-amber"
                : "border-border-strong bg-surface text-fg-2",
            )}
          >
            {item.bylineAs === "anonymous" ? "Anonymous" : "Real name"}
          </span>
        </span>
      </div>

      {item.overview && (
        <p className="mb-3 line-clamp-2 text-[13.5px] leading-[1.55] text-fg-2">
          {item.overview}
        </p>
      )}

      <div className="mb-3 flex items-center gap-3 text-[12.5px] text-fg-3">
        <span>
          <b className="font-semibold text-fg">{item.questions}</b> questions
        </span>
        <span className="size-[3px] rounded-full bg-fg-4" />
        <span>
          <b className="font-semibold text-fg">{item.tips}</b> prep tips
        </span>
        <span className="size-[3px] rounded-full bg-fg-4" />
        <span>{item.hasReflection ? "Has reflection" : "No reflection"}</span>
      </div>

      {/* Proposed-company resolution (concern #10): the student named a company
          that isn't canonical yet. Map it to an existing one (dedup) or promote
          it - required before this post can be approved. */}
      {unresolved && (
        <CompanyResolver
          proposed={item.proposedCompany ?? ""}
          busy={busy}
          onResolve={(resolution) => resolveCompany(item.id, resolution)}
        />
      )}

      {/* Full post, inline - moderators approve what they actually read */}
      {open && <FullPost item={item} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse post" : "Open full post →"}
        </Button>
        <span className="flex-1" />
        <Button
          onClick={() => setAsk("reject")}
          disabled={busy}
          className="border-red-border bg-transparent text-red hover:bg-red-soft"
        >
          <Icon.x /> Reject
        </Button>
        <Button
          onClick={() => setAsk("edits")}
          disabled={busy}
          className="border-amber-border bg-amber-soft text-amber hover:bg-[rgba(245,181,68,0.2)]"
        >
          <Icon.pencil /> Suggest edits
        </Button>
        <Button
          onClick={() =>
            run(item.id, () => approveExperience(item.id), "Approved - the post is live")
          }
          disabled={busy || unresolved}
          title={unresolved ? "Resolve the proposed company first" : undefined}
          className={cn(
            "border-white/10 bg-gradient-to-b from-[#34c97f] to-[#1f8a5b] text-white shadow-[0_0_0_1px_var(--color-green-border),0_4px_14px_-3px_rgba(46,207,133,0.35)] hover:from-[#3fd48a] hover:to-[#249a66]",
            unresolved && "cursor-not-allowed opacity-50",
          )}
        >
          <Icon.check /> {busy ? "Working…" : "Approve & publish"}
        </Button>
      </div>

      <ReasonModal
        open={ask !== null}
        title={ask === "reject" ? "Reject this post?" : "Suggest edits"}
        description={
          ask === "reject"
            ? "The author is notified with your reason and can submit a corrected version (fresh entry, back of the queue)."
            : "The post returns to the author with your note shown inline on My Posts; they edit and resubmit."
        }
        placeholder={
          ask === "reject"
            ? "Reason (required) - e.g. names an interviewer, NDA violation, factually wrong about the process…"
            : "Reviewer note (required) - e.g. please remove the interviewer's name in Question 3…"
        }
        confirmLabel={ask === "reject" ? "Reject post" : "Send back for edits"}
        tone={ask === "reject" ? "red" : "amber"}
        busy={busy}
        onConfirm={async (text) => {
          const which = ask;
          setAsk(null);
          if (which === "reject")
            await run(item.id, () => rejectExperience(item.id, text), "Rejected - author notified");
          else
            await run(item.id, () => suggestEdits(item.id, text), "Sent back with your note");
        }}
        onClose={() => setAsk(null)}
      />
    </div>
  );
}

// Compact inline rendering of the full submission for review.
function FullPost({ item }: { item: OpsQueueItem }) {
  const d = item.detail;
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-md border border-border bg-bg-2 p-3.5">
      {d.overview && <FullPostSection label="Overview" body={d.overview} />}
      {(d.questionsList ?? []).map((q) => (
        <div key={q.n} className="rounded-md border border-border bg-surface px-3 py-2.5">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-3">
            <b className="font-semibold text-fg-2">Q{q.n}</b>
            <span>{q.topic}</span>
            {q.difficulty > 0 && <span>· difficulty {q.difficulty}/5</span>}
            {q.platform && <span>· {q.platform}</span>}
          </div>
          <p className="m-0 text-[13px] leading-[1.55] text-fg">{q.summary}</p>
          {q.approach && (
            <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.55] text-fg-2">{q.approach}</p>
          )}
        </div>
      ))}
      {(d.prepTips ?? []).length > 0 && (
        <FullPostSection
          label={`Prep tips (${d.prepTips!.length})`}
          body={d.prepTips!.map((t) => `[${t.category}] ${t.text}`).join("\n")}
        />
      )}
      {d.reflection && <FullPostSection label="Reflections" body={d.reflection} />}
    </div>
  );
}

function FullPostSection({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
        {label}
      </div>
      <p className="m-0 whitespace-pre-line text-[13px] leading-[1.6] text-fg-2">{body}</p>
    </div>
  );
}

function PublishedRow({
  item,
  busy,
  canModerate,
  onHide,
  onUnhide,
}: {
  item: OpsPublishedItem;
  busy: boolean;
  canModerate: boolean;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const hidden = Boolean(item.hiddenAt);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-[18px] py-3.5",
        hidden && "border-red-border/60 bg-red-soft/30",
      )}
    >
      <div className="grid size-[38px] place-items-center rounded-[9px] border border-border-strong bg-bg-2 text-[15px] font-bold">
        {item.company[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <b className="font-semibold">{item.company}</b>
          <span className="font-normal text-fg-3">·</span>
          <span className="text-fg-2">
            {item.role} · {item.round}
          </span>
          <OutcomePill outcome={item.outcome} />
          {hidden && (
            <Pill className="border-red-border bg-red-soft text-red">Hidden</Pill>
          )}
        </div>
        <div className="mt-0.5 text-xs text-fg-3">
          {hidden
            ? `Hidden ${item.hiddenAt} - ${item.hiddenReason}`
            : `Published ${item.publishedAt} · ${item.views} views · ${item.helpful} helpful`}
        </div>
      </div>
      {!canModerate ? (
        <span className="text-[11.5px] text-fg-3">View only</span>
      ) : hidden ? (
        <Button onClick={onUnhide} disabled={busy}>
          <Icon.eye /> {busy ? "Working…" : "Unhide"}
        </Button>
      ) : (
        <Button
          onClick={onHide}
          disabled={busy}
          className="border-red-border bg-transparent text-red hover:bg-red-soft"
        >
          <Icon.eye /> Hide
        </Button>
      )}
    </div>
  );
}

// Proposed-company resolver: map the student's typed name to an existing
// canonical company (dedup - the typed spelling is folded in as an alias) or
// promote it to a new canonical company. The single Ops gate for concern #10.
function CompanyResolver({
  proposed,
  busy,
  onResolve,
}: {
  proposed: string;
  busy: boolean;
  onResolve: (resolution: CompanyResolution) => Promise<boolean>;
}) {
  const [q, setQ] = useState(proposed);
  const [matches, setMatches] = useState<{ id: string; name: string; industry: string }[]>([]);
  const [mode, setMode] = useState<"map" | "new">("map");
  const [newName, setNewName] = useState(proposed);
  const [newIndustry, setNewIndustry] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) {
        setMatches([]);
        return;
      }
      try {
        setMatches(await searchCompaniesForResolve(term));
      } catch {
        setMatches([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const INPUT =
    "h-9 w-full rounded-md border border-border bg-bg-2 px-3 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]";

  return (
    <div className="mb-3 rounded-md border border-amber-border bg-amber-soft/40 p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-amber">
        <Icon.warn className="size-4 shrink-0" />
        New company “{proposed}” - map it to an existing company or add it before approving.
      </div>

      <div className="mb-2.5 inline-flex overflow-hidden rounded-md border border-border bg-surface">
        {(["map", "new"] as const).map((m, i) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "h-8 px-3 text-xs font-medium transition-[background,color]",
              i === 0 && "border-r border-border",
              mode === m ? "bg-blue-soft text-blue" : "text-fg-3 hover:text-fg",
            )}
          >
            {m === "map" ? "Map to existing" : "Add as new"}
          </button>
        ))}
      </div>

      {mode === "map" ? (
        <div className="flex flex-col gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search canonical companies…"
            className={INPUT}
          />
          {matches.length === 0 ? (
            <p className="px-0.5 text-[12px] text-fg-3">
              {q.trim().length < 2 ? "Type to search." : "No canonical match - add it as new instead."}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onResolve({ existingCompanyId: c.id })}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-left text-[13px] hover:border-blue-border disabled:opacity-50"
                >
                  <span className="grid size-6 place-items-center rounded-[6px] border border-border-strong bg-bg-2 text-[12px] font-bold">
                    {c.name[0]}
                  </span>
                  <b className="font-semibold">{c.name}</b>
                  {c.industry && <span className="text-[11.5px] text-fg-3">{c.industry}</span>}
                  <span className="ml-auto text-[11.5px] font-medium text-blue">Map →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Company name"
            className={INPUT}
          />
          <input
            value={newIndustry}
            onChange={(e) => setNewIndustry(e.target.value)}
            placeholder="Industry (optional) - e.g. Fintech"
            className={INPUT}
          />
          <Button
            variant="primary"
            disabled={busy || !newName.trim()}
            onClick={() =>
              onResolve({ newCompany: { name: newName.trim(), industry: newIndustry.trim() || undefined } })
            }
            className="self-start"
          >
            <Icon.plus /> {busy ? "Adding…" : "Add canonical company"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Generic required-reason modal (reject / suggest edits).
function ReasonModal({
  open,
  title,
  description,
  placeholder,
  confirmLabel,
  tone,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  tone: "red" | "amber";
  busy: boolean;
  onConfirm: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setText("");
          onClose();
        }
      }}
      title={title}
      description={description}
    >
      <textarea
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder={placeholder}
        className="min-h-[100px] w-full resize-y rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
      />
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-xs text-fg-3">The author sees this verbatim.</span>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            disabled={!text.trim() || busy}
            onClick={() => {
              onConfirm(text.trim());
              setText("");
            }}
            className={cn(
              tone === "red"
                ? "border-red-border bg-red-soft text-red hover:bg-[rgba(239,90,90,0.2)]"
                : "border-amber-border bg-amber-soft text-amber hover:bg-[rgba(245,181,68,0.2)]",
              (!text.trim() || busy) && "cursor-not-allowed opacity-50",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Hide-with-reason: the reason is REQUIRED (PRD §10 - no silent hides; logged
// to moderation_actions; the author is notified).
function HideModal({
  target,
  busy,
  onConfirm,
  onClose,
}: {
  target: OpsPublishedItem | null;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
      title="Hide this published post?"
      description={
        target
          ? `"${target.role} · ${target.round} at ${target.company}" will be pulled from every student-facing view. The author sees your reason and can edit + resubmit for re-review.`
          : undefined
      }
    >
      <textarea
        value={reason}
        onChange={(ev) => setReason(ev.target.value)}
        placeholder="Reason (required) - e.g. a factual claim was disputed, identifying details, etc."
        className="min-h-[100px] w-full resize-y rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
      />
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-xs text-fg-3">Logged: who hid it, when, and why.</span>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reason.trim() || busy}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
            className={cn(
              "border-red-border bg-red-soft text-red hover:bg-[rgba(239,90,90,0.2)]",
              (!reason.trim() || busy) && "cursor-not-allowed opacity-50",
            )}
          >
            {busy ? "Hiding…" : "Hide post"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
