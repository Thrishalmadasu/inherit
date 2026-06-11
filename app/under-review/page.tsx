import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { OutcomePill, RoundPill, Pill, PillDot } from "@/components/ui/pill";
import { QuestionCard, PrepTip, Section } from "@/components/experience/blocks";
import { company, experiences } from "@/lib/mock/data";

// Author's view of a submitted-but-not-yet-published post: reassurance banner
// + a dashed "preview frame" of exactly how the post will render once live.
export default function UnderReviewPage() {
  const exp = experiences.find((e) => e.questionsList) ?? experiences[0];
  const questions = exp.questionsList ?? [];
  const tips = exp.prepTips ?? [];

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[876px] px-7 pb-20 pt-7">
        {/* Breadcrumb */}
        <div className="mb-[18px] flex items-center gap-2 text-[13px] text-fg-3">
          <Link href="/me" className="hover:text-fg">
            My posts
          </Link>
          <Icon.chev className="size-3 opacity-60" />
          <span className="text-fg">
            {exp.role} · {exp.round} at {company.name}
          </span>
        </div>

        {/* Reassurance banner */}
        <div className="relative mb-7 overflow-hidden rounded-lg border border-blue-border bg-[linear-gradient(180deg,rgba(46,160,248,0.06),rgba(46,160,248,0.02)_60%),var(--color-surface)] px-7 py-[26px] shadow-[0_0_0_1px_var(--color-blue-border),0_0_32px_-6px_var(--color-blue-glow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Pill tone="blue">
                <PillDot />
                Under Review
              </Pill>
              <h1 className="mb-1.5 mt-2 text-[22px] font-bold tracking-[-0.02em]">
                Your post is in the review queue
              </h1>
              <p className="m-0 max-w-[640px] text-sm leading-[1.6] text-fg-2">
                Placement Ops will publish it shortly. We&apos;ll email you at{" "}
                <b className="text-fg">thrishal.23bcs10115@sst.scaler.com</b> the
                moment it goes live. You can edit or withdraw it until then.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button href="/share?edit=my-019">
                <Icon.pencil /> Edit submission
              </Button>
              <Button>Withdraw</Button>
            </div>
          </div>
        </div>

        {/* Preview frame */}
        <div className="relative rounded-lg border border-dashed border-border-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_80%)] px-[22px] pb-[22px] pt-[18px]">
          <span className="absolute -top-2.5 left-[18px] bg-bg px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
            Preview · This is exactly how your post will appear once approved
          </span>

          <header className="mb-[18px] border-b border-border pb-[18px]">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              {exp.round && <RoundPill round={exp.round} />}
              {exp.outcome && <OutcomePill outcome={exp.outcome} />}
              <Pill>
                <Icon.calendar className="size-[11px]" /> {exp.year}
              </Pill>
              {exp.platform && <Pill>{exp.platform}</Pill>}
            </div>
            <h1 className="mb-1.5 text-2xl font-bold leading-[1.25] tracking-[-0.025em]">
              {exp.role} · {exp.round} at {company.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-fg-2">
              <span>{company.name}</span>
              <span className="size-[3px] rounded-full bg-fg-4" />
              <span>{company.industry}</span>
            </div>
            <div className="mt-[18px] flex items-center gap-3">
              <span className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-[13.5px] font-semibold text-white">
                TM
              </span>
              <div>
                <div className="text-[14.5px] font-semibold tracking-[-0.005em]">
                  {exp.author.name} · {exp.author.batch}
                </div>
                <div className="text-xs text-fg-3">SST · School of Technology</div>
              </div>
            </div>
          </header>

          <Section title="Overview" className="mt-0">
            <p className="m-0 text-[14.5px] leading-[1.65] text-fg-2">
              {exp.overview}
            </p>
          </Section>

          <Section title="Questions" count={`${questions.length} total`}>
            {questions.slice(0, 2).map((q) => (
              <QuestionCard key={q.n} q={q} />
            ))}
            {questions.length > 2 && (
              <p className="mt-2 text-center text-[12.5px] text-fg-3">
                + {questions.length - 2} more questions
              </p>
            )}
          </Section>

          <Section title="Prep tips" count={String(tips.length)}>
            <div className="grid gap-2.5">
              {tips.slice(0, 2).map((t, i) => (
                <PrepTip key={i} tip={t} />
              ))}
            </div>
            {tips.length > 2 && (
              <p className="mt-3 text-center text-[12.5px] text-fg-3">
                + {tips.length - 2} more tips
              </p>
            )}
          </Section>

          <Section title="Reflections">
            <div className="relative rounded-lg border border-border bg-[linear-gradient(180deg,rgba(46,160,248,0.04),transparent_80%),var(--color-surface)] py-[22px] pl-7 pr-[22px]">
              <span className="absolute bottom-[18px] left-0 top-[18px] w-[3px] rounded-r-[3px] bg-gradient-to-b from-blue to-blue-deep shadow-[0_0_12px_var(--color-blue-glow)]" />
              <span className="pointer-events-none absolute right-[18px] top-3.5 select-none font-serif text-[48px] leading-none text-blue opacity-[0.18]">
                &ldquo;
              </span>
              <p className="m-0 text-[15px] leading-[1.7] tracking-[0.005em] text-fg">
                {exp.reflection?.split("\n\n")[0]}
              </p>
            </div>
          </Section>
        </div>
      </main>
    </>
  );
}
