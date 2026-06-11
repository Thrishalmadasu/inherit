"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { OutcomePill, Pill, RoundPill } from "@/components/ui/pill";
import { Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { experiences, opsQueue, type OpsQueueItem } from "@/lib/mock/data";

type View = "all" | "anonymous" | "published";

// Tonight: actions are toast-only (no DB writes). The real moderation actions
// land with the write loop. FIFO order = the mock array order (oldest last).
export default function OpsQueuePage() {
  const [view, setView] = useState<View>("all");
  const [hideTarget, setHideTarget] = useState<string | null>(null);

  const counts = {
    all: opsQueue.length,
    anonymous: opsQueue.filter((q) => q.bylineAs === "anonymous").length,
    published: experiences.length,
  };

  const pending = useMemo(
    () =>
      view === "anonymous"
        ? opsQueue.filter((q) => q.bylineAs === "anonymous")
        : opsQueue,
    [view],
  );

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
          Oldest pending 3h 12m · review target 24h · FIFO
        </span>
      </div>

      {view !== "published" ? (
        pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-10 text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">Queue is clear.</strong>
            New submissions will appear here as they come in.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pending.map((q) => (
              <ModCard key={q.id} item={q} />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2.5">
          {experiences.map((e) => (
            <PublishedRow key={e.id} id={e.id} onHide={() => setHideTarget(e.id)} />
          ))}
        </div>
      )}

      <HideModal
        targetId={hideTarget}
        onClose={() => setHideTarget(null)}
      />
    </>
  );
}

function ModCard({ item }: { item: OpsQueueItem }) {
  const initials = item.realAuthor.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const act = (msg: string) => () =>
    toast(`${msg} — real moderation actions arrive with the database`);

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

      <p className="mb-3 line-clamp-2 text-[13.5px] leading-[1.55] text-fg-2">
        {item.overview}
      </p>

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

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button onClick={act("Open full post")}>Open full post →</Button>
        <span className="flex-1" />
        <Button
          onClick={act("Rejected")}
          className="border-red-border bg-transparent text-red hover:bg-red-soft"
        >
          <Icon.x /> Reject
        </Button>
        <Button
          onClick={act("Edits suggested")}
          className="border-amber-border bg-amber-soft text-amber hover:bg-[rgba(245,181,68,0.2)]"
        >
          <Icon.pencil /> Suggest edits
        </Button>
        <Button
          onClick={act("Approved")}
          className="border-white/10 bg-gradient-to-b from-[#34c97f] to-[#1f8a5b] text-white shadow-[0_0_0_1px_var(--color-green-border),0_4px_14px_-3px_rgba(46,207,133,0.35)] hover:from-[#3fd48a] hover:to-[#249a66]"
        >
          <Icon.check /> Approve &amp; publish
        </Button>
      </div>
    </div>
  );
}

function PublishedRow({ id, onHide }: { id: string; onHide: () => void }) {
  const e = experiences.find((x) => x.id === id)!;
  const round = e.round ?? e.rounds?.[0]?.round ?? "";
  const outcome = e.outcome ?? e.overallOutcome;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-[18px] py-3.5">
      <div className="grid size-[38px] place-items-center rounded-[9px] border border-border-strong bg-bg-2 text-[15px] font-bold">
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <b className="font-semibold">Amazon</b>
          <span className="font-normal text-fg-3">·</span>
          <span className="text-fg-2">
            {e.role} · {round}
          </span>
          {outcome && <OutcomePill outcome={outcome} />}
        </div>
        <div className="mt-0.5 text-xs text-fg-3">
          Published {e.submittedAt} · {e.views ?? 0} views · {e.helpful ?? 0} helpful
        </div>
      </div>
      <Button
        onClick={onHide}
        className="border-red-border bg-transparent text-red hover:bg-red-soft"
      >
        <Icon.eye /> Hide
      </Button>
    </div>
  );
}

// Hide-with-reason: the reason is REQUIRED (PRD — no silent hides; logged to
// ModerationAction once the DB lands).
function HideModal({ targetId, onClose }: { targetId: string | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const e = targetId ? experiences.find((x) => x.id === targetId) : null;

  const confirm = () => {
    toast("Post hidden — the author has been notified with your reason");
    setReason("");
    onClose();
  };

  return (
    <Modal
      open={!!targetId}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
      title="Hide this published post?"
      description={
        e
          ? `"${e.role} · ${e.round ?? e.rounds?.[0]?.round} at Amazon" will be pulled from every student-facing view. The author sees your reason and can edit + resubmit for re-review.`
          : undefined
      }
    >
      <textarea
        value={reason}
        onChange={(ev) => setReason(ev.target.value)}
        placeholder="Reason (required) — e.g. a factual claim was disputed, identifying details, etc."
        className="min-h-[100px] w-full resize-y rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
      />
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-xs text-fg-3">
          Logged: who hid it, when, and why.
        </span>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            disabled={!reason.trim()}
            onClick={confirm}
            className={cn(
              "border-red-border bg-red-soft text-red hover:bg-[rgba(239,90,90,0.2)]",
              !reason.trim() && "cursor-not-allowed opacity-50",
            )}
          >
            Hide post
          </Button>
        </div>
      </div>
    </Modal>
  );
}
