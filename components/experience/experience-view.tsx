"use client";

import { useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { OutcomePill, RoundPill, Pill } from "@/components/ui/pill";
import { Difficulty } from "@/components/ui/primitives";
import { QuestionCard, PrepTip, Section } from "@/components/experience/blocks";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { Experience } from "@/lib/mock/data";

export function ExperienceView({
  exp,
  related,
  company,
}: {
  exp: Experience;
  related: Experience[];
  company: { name: string; slug: string; industry: string };
}) {
  const [saved, setSaved] = useState(false);
  const [helpful, setHelpful] = useState(false);
  const helpfulCount = (exp.helpful ?? 0) + (helpful ? 1 : 0);

  const toggleSave = () => {
    setSaved((s) => {
      toast(!s ? "Saved to My posts" : "Removed from Saved");
      return !s;
    });
  };
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied to clipboard");
    } catch {
      toast("Couldn't copy — select the address bar to share");
    }
  };

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
            <span className="text-fg">
              {exp.role} · {exp.round}
            </span>
          </div>

          {/* Header */}
          <header className="mb-6 border-b border-border pb-6">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              {exp.round && <RoundPill round={exp.round} />}
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
              {exp.role} · {exp.round} at {company.name}
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
              </div>
            </div>
          </header>

          {/* Overview */}
          <Section title="Overview">
            <p className="m-0 text-[14.5px] leading-[1.65] text-fg-2">{exp.overview}</p>
          </Section>

          {/* Questions */}
          <Section title="Questions" count={`${exp.questionsList?.length ?? 0} total`}>
            {exp.questionsList?.map((q) => <QuestionCard key={q.n} q={q} />)}
          </Section>

          {/* Prep tips */}
          <Section title="Prep tips" count={String(exp.prepTips?.length ?? 0)}>
            <div className="grid gap-2.5">
              {exp.prepTips?.map((t, i) => <PrepTip key={i} tip={t} />)}
            </div>
          </Section>

          {/* Reflections */}
          <Section title="Reflections">
            <div className="relative rounded-lg border border-border bg-[linear-gradient(180deg,rgba(46,160,248,0.04),transparent_80%),var(--color-surface)] py-[22px] pl-7 pr-[22px]">
              <span className="absolute bottom-[18px] left-0 top-[18px] w-[3px] rounded-r-[3px] bg-gradient-to-b from-blue to-blue-deep shadow-[0_0_12px_var(--color-blue-glow)]" />
              <span className="pointer-events-none absolute right-[18px] top-3.5 select-none font-serif text-[48px] leading-none text-blue opacity-[0.18]">
                &ldquo;
              </span>
              {exp.reflection?.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className="mb-3 text-[15px] leading-[1.7] tracking-[0.005em] text-fg last:mb-0"
                >
                  {para}
                </p>
              ))}
            </div>
          </Section>

          {/* Helpful (V1: Helpful-only) */}
          <Section title="Was this helpful?" count={`${helpfulCount} found it helpful`}>
            <p className="mb-3 text-[14.5px] leading-[1.65] text-fg-2">
              Signal helps us promote the most useful experiences to the top of
              company pages.
            </p>
            <button
              onClick={() => setHelpful((v) => !v)}
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
              <KV k="Round" v={exp.round ?? "—"} />
              <span className="text-fg-3">Outcome</span>
              <span className="text-right">
                {exp.outcome && <OutcomePill outcome={exp.outcome} />}
              </span>
              <KV k="Platform" v={exp.platform ?? "—"} />
              <KV k="Duration" v={exp.duration ?? "—"} />
              <KV k="Year" v={String(exp.year)} />
              <span className="text-fg-3">Difficulty</span>
              <span className="text-right">
                <Difficulty value={exp.avgDifficulty ?? 0} />
              </span>
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
              Your post helps the next batch prep faster — submissions usually go
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
            SST {exp.author.batch} student
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
          {exp.author.name} · {exp.author.batch}
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
