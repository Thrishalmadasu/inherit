"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { OutcomePill, RoundPill, Pill } from "@/components/ui/pill";
import { QuestionCard, PrepTip, Section } from "@/components/experience/blocks";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
// difficulty intentionally dropped — too subjective / discouraging for students
import { toast } from "@/lib/toast";
import { recordView, setHelpful, setSaved } from "@/app/actions/engagement";
import { hideExperience } from "@/app/actions/moderation";
import type { Experience, QuestionDetail } from "@/lib/types";

export function ExperienceView({
  exp,
  related,
  company,
  viewer,
  canModerate,
}: {
  exp: Experience;
  related: Experience[];
  company: { name: string; slug: string; industry: string };
  viewer: { helpful: boolean; saved: boolean };
  canModerate: boolean;
}) {
  const [saved, setSavedState] = useState(viewer.saved);
  const [helpful, setHelpfulState] = useState(viewer.helpful);
  // exp.helpful already includes the viewer's persisted vote - only the
  // optimistic delta vs. what the server knew at render time is added here.
  const helpfulCount =
    (exp.helpful ?? 0) + (helpful === viewer.helpful ? 0 : helpful ? 1 : -1);

  // Every page open counts one view. The ref de-dupes within a single mount
  // (React dev strict-mode runs effects twice); a reload or revisit is a new
  // mount and counts again - that's the product intent.
  const viewSent = useRef<string | null>(null);
  useEffect(() => {
    if (viewSent.current === exp.id) return;
    viewSent.current = exp.id;
    void recordView(exp.id);
  }, [exp.id]);

  // Optimistic with rollback: flip locally, persist, revert on failure.
  const toggleSave = () => {
    const next = !saved;
    setSavedState(next);
    toast(next ? "Saved to My posts" : "Removed from Saved");
    void setSaved(exp.id, next).then((r) => {
      if (!r.ok) {
        setSavedState(!next);
        toast(r.error);
      }
    });
  };
  const toggleHelpful = () => {
    const next = !helpful;
    setHelpfulState(next);
    void setHelpful(exp.id, next).then((r) => {
      if (!r.ok) {
        setHelpfulState(!next);
        toast(r.error);
      }
    });
  };
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied to clipboard");
    } catch {
      toast("Couldn't copy - select the address bar to share");
    }
  };

  // The full round pipeline (multi-round) or the single round, for the header.
  const roundNames = exp.rounds?.map((r) => r.round) ?? (exp.round ? [exp.round] : []);
  // Regroup the flat question list back into its rounds so the detail page
  // shows every round, not just the first.
  const questionGroups: { round?: string; questions: QuestionDetail[] }[] = [];
  for (const q of exp.questionsList ?? []) {
    const last = questionGroups[questionGroups.length - 1];
    if (last && last.round === q.round) last.questions.push(q);
    else questionGroups.push({ round: q.round, questions: [q] });
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-9 px-7 pb-20 pt-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* Breadcrumb */}
          <div className="mb-[18px] flex items-center gap-2 text-[13px] text-fg-3">
            <Link href="/companies" className="hover:text-fg">
              Companies
            </Link>
            <Icon.chev className="size-3 opacity-60" />
            <Link href={`/companies/${company.slug}`} className="hover:text-fg">
              {company.name}
            </Link>
            <Icon.chev className="size-3 opacity-60" />
            <span className="text-fg">{exp.role}</span>
          </div>

          {/* Header */}
          <header className="mb-6 border-b border-border pb-6">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              {roundNames.map((rn, i) => (
                <Fragment key={i}>
                  <RoundPill round={rn} />
                  {i < roundNames.length - 1 && (
                    <Icon.arrow className="size-3 shrink-0 text-fg-4" />
                  )}
                </Fragment>
              ))}
              {exp.outcome && <OutcomePill outcome={exp.outcome} />}
              <Pill>
                <Icon.calendar className="size-[11px]" /> {exp.year}
              </Pill>
              {exp.platform && <Pill>{exp.platform}</Pill>}
              {exp.duration && (
                <Pill>
                  <Icon.clock className="size-[11px]" /> {exp.duration}
                </Pill>
              )}
            </div>
            <h1 className="mb-1.5 text-[28px] font-bold leading-[1.25] tracking-[-0.025em]">
              {exp.role} at {company.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-fg-2">
              <Link href={`/companies/${company.slug}`} className="hover:text-fg">
                {company.name}
              </Link>
              <span className="size-[3px] rounded-full bg-fg-4" />
              <span>{company.industry}</span>
              <span className="size-[3px] rounded-full bg-fg-4" />
              <span>Submitted {exp.submittedAt}</span>
            </div>

            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
              <Byline exp={exp} />
              <div className="flex gap-2">
                <Button
                  onClick={toggleSave}
                  aria-pressed={saved}
                  className={cn(
                    saved &&
                      "border-blue-border bg-blue-soft text-blue hover:bg-[rgba(46,160,248,0.18)]",
                  )}
                >
                  {saved ? (
                    <Icon.bookmarkFilled />
                  ) : (
                    <Icon.bookmark />
                  )}
                  {saved ? "Saved" : "Save"}
                </Button>
                <Button onClick={handleShare}>
                  <Icon.upload /> Share
                </Button>
                {canModerate && <ModeratorHide expId={exp.id} />}
              </div>
            </div>
          </header>

          {/* Overview — omitted when the experience has none (e.g. imports) */}
          {exp.overview?.trim() && (
            <Section title="Overview">
              <p className="m-0 text-[14.5px] leading-[1.65] text-fg-2">{exp.overview}</p>
            </Section>
          )}

          {/* Questions — grouped by round so multi-round pipelines are clear */}
          <Section title="Questions" count={`${exp.questionsList?.length ?? 0} total`}>
            {questionGroups.map((g, gi) => (
              <div key={gi} className="mb-6 last:mb-0">
                {questionGroups.length > 1 && g.round && (
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="grid size-6 place-items-center rounded-full border border-blue-border bg-blue-soft text-[11px] font-bold tabular-nums text-blue">
                      {gi + 1}
                    </span>
                    <h3 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-fg">
                      {g.round}
                    </h3>
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-fg-3">
                      {g.questions.length} {g.questions.length === 1 ? "question" : "questions"}
                    </span>
                  </div>
                )}
                <div className="grid gap-2.5">
                  {g.questions.map((q) => <QuestionCard key={q.n} q={q} />)}
                </div>
              </div>
            ))}
          </Section>

          {/* Prep tips — omitted when there are none */}
          {(exp.prepTips?.length ?? 0) > 0 && (
            <Section title="Prep tips" count={String(exp.prepTips!.length)}>
              <div className="grid gap-2.5">
                {exp.prepTips!.map((t, i) => <PrepTip key={i} tip={t} />)}
              </div>
            </Section>
          )}

          {/* Reflections — omitted when the author wrote none */}
          {exp.reflection?.trim() && (
            <Section title="Reflections">
              <div className="relative rounded-lg border border-border bg-[linear-gradient(180deg,rgba(46,160,248,0.04),transparent_80%),var(--color-surface)] py-[22px] pl-7 pr-[22px]">
                <span className="absolute bottom-[18px] left-0 top-[18px] w-[3px] rounded-r-[3px] bg-gradient-to-b from-blue to-blue-deep shadow-[0_0_12px_var(--color-blue-glow)]" />
                <span className="pointer-events-none absolute right-[18px] top-3.5 select-none font-serif text-[48px] leading-none text-blue opacity-[0.18]">
                  &ldquo;
                </span>
                {exp.reflection.split("\n\n").map((para, i) => (
                  <p
                    key={i}
                    className="mb-3 text-[15px] leading-[1.7] tracking-[0.005em] text-fg last:mb-0"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* Helpful (V1: Helpful-only) */}
          <Section title="Was this helpful?" count={`${helpfulCount} found it helpful`}>
            <p className="mb-3 text-[14.5px] leading-[1.65] text-fg-2">
              Signal helps us promote the most useful experiences to the top of
              company pages.
            </p>
            <button
              onClick={toggleHelpful}
              aria-pressed={helpful}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-4 text-[12.5px] [&_svg]:size-[13px]",
                helpful
                  ? "border-blue-border bg-blue-soft text-blue"
                  : "border-border bg-bg-2 text-fg-2 hover:border-border-hover hover:text-fg",
              )}
            >
              {helpful ? <Icon.check /> : <Icon.thumbUp />}
              {helpful ? "You found this helpful" : "Yes, helpful"}
            </button>
          </Section>
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-3.5 self-start lg:sticky lg:top-[84px] lg:h-fit">
          <RailCard title="At a glance">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-[13px]">
              <KV k="Company" v={company.name} />
              <KV k="Role" v={exp.role} />
              <KV k="Round" v={exp.round ?? "-"} />
              <span className="text-fg-3">Outcome</span>
              <span className="text-right">
                {exp.outcome && <OutcomePill outcome={exp.outcome} />}
              </span>
              <KV k="Platform" v={exp.platform ?? "-"} />
              <KV k="Duration" v={exp.duration ?? "-"} />
              <KV k="Year" v={String(exp.year)} />
            </div>
            <div className="mt-3.5">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">
                Topics
              </span>
              <div className="flex flex-wrap gap-1.5">
                {exp.topics?.map((t) => (
                  <span
                    key={t}
                    className="inline-flex h-[22px] items-center rounded-full border border-border bg-bg-2 px-[9px] text-[11.5px] font-medium text-fg-2"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </RailCard>

          <RailCard title={`More from ${company.name}`}>
            {related.map((r, i) => {
              const round = r.round ?? r.rounds?.[0]?.round ?? "";
              const outcome = r.outcome ?? r.overallOutcome;
              return (
                <Link
                  key={r.id}
                  href={`/experiences/${r.id}`}
                  className={cn(
                    "group block border-t border-border py-2.5 text-[13px] text-fg",
                    i === 0 && "border-t-0 pt-0",
                  )}
                >
                  <div className="font-medium group-hover:text-blue">
                    {r.role} · {round}
                  </div>
                  <div className="mt-[3px] flex items-center gap-[7px] text-[11.5px] text-fg-3">
                    {outcome && <OutcomePill outcome={outcome} />}
                    <span className="size-[3px] rounded-full bg-fg-4" />
                    <span>{r.submittedAt}</span>
                  </div>
                </Link>
              );
            })}
          </RailCard>

          <RailCard title="Have an experience to share?">
            <p className="mb-3 text-[13px] leading-[1.55] text-fg-2">
              Your post helps the next batch prep faster - submissions usually go
              live within 24 hours.
            </p>
            <Button href="/share" variant="primary" className="w-full justify-center">
              <Icon.plus /> Share experience
            </Button>
          </RailCard>
        </aside>
      </main>
    </>
  );
}

function Byline({ exp }: { exp: Experience }) {
  if (exp.author.anonymous) {
    return (
      <div className="flex items-center gap-3">
        <span className="grid size-[38px] place-items-center rounded-full border border-dashed border-border-strong bg-surface-3 text-[13.5px] text-fg-3">
          ?
        </span>
        <div>
          <div className="text-[14.5px] font-medium italic text-fg-2">
            {exp.author.batch ? `SST ${exp.author.batch} student` : "SST student"}
          </div>
          <div className="text-xs text-fg-3">
            Anonymous · identity verified by Placement Ops
          </div>
        </div>
      </div>
    );
  }
  const initials = (exp.author.name ?? "")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-[13.5px] font-semibold text-white">
        {initials}
      </span>
      <div>
        <div className="text-[14.5px] font-semibold tracking-[-0.005em]">
          {exp.author.name}
          {exp.author.batch && ` · ${exp.author.batch}`}
        </div>
        <div className="text-xs text-fg-3">SST · School of Technology</div>
      </div>
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-[18px] pb-[18px] pt-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-fg-3">{k}</span>
      <span className="text-right font-medium text-fg">{v}</span>
    </>
  );
}

// De-emphasized moderator-only control (concern #4): a quiet, muted button
// rather than a prominent one, so a moderator can hide a live post from
// anywhere it's visible without the action being easy to fat-finger. The
// reason modal + destructive styling only appear once they commit. The action
// is also role-gated server-side (requireModerator).
function ModeratorHide({ expId }: { expId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    const res = await hideExperience(expId, reason.trim());
    setBusy(false);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    setOpen(false);
    setReason("");
    toast("Post hidden - pulled from student-facing views (logged)");
    router.push("/feed");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Moderator: hide this post"
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-2 [&_svg]:size-[13px]"
      >
        <Icon.shield /> Hide
      </button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setReason("");
            setOpen(false);
          }
        }}
        title="Hide this post?"
        description="It will be pulled from every student-facing view. The author sees your reason and can edit + resubmit for re-review."
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) - e.g. a factual claim was disputed, identifying details, etc."
          className="min-h-[100px] w-full resize-y rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
        />
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className="text-xs text-fg-3">Logged: who hid it, when, and why.</span>
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!reason.trim() || busy}
              onClick={confirm}
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
    </>
  );
}
