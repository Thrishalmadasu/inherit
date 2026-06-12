import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { OutcomePill, RoundPill, Pill, PillDot } from "@/components/ui/pill";
import { QuestionCard, PrepTip, Section } from "@/components/experience/blocks";
import { PendingActions } from "@/components/under-review/pending-actions";
import { requireDbUser } from "@/lib/auth";
import { getMyPendingPost } from "@/lib/db/queries";
import { initialsOf } from "@/lib/user-display";

// Author's view of their submitted-but-not-yet-published post: reassurance
// banner + a dashed "preview frame" of exactly how it will render once live.
// Reads the author's actual newest pending submission.
export default async function UnderReviewPage() {
  const user = await requireDbUser();
  const pending = await getMyPendingPost(user.id);

  if (!pending) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-[640px] px-7 pb-24 pt-16 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-border-strong bg-surface-3 text-fg-3">
            <Icon.doc className="size-6" />
          </div>
          <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em]">
            Nothing under review right now
          </h1>
          <p className="mx-auto mb-8 max-w-[460px] text-sm leading-[1.6] text-fg-2">
            When you submit an experience it waits here while Placement Ops
            reviews it — first-in, first-out.
          </p>
          <div className="flex justify-center gap-2.5">
            <Button href="/me">My posts</Button>
            <Button href="/share" variant="primary">
              <Icon.plus /> Share an experience
            </Button>
          </div>
        </main>
      </>
    );
  }

  const { exp } = pending;
  const questions = exp.questionsList ?? [];
  const tips = exp.prepTips ?? [];
  const title = `${exp.role} · ${exp.round ?? pending.companyName} at ${pending.companyName}`;
  const byline = exp.author.anonymous
    ? `SST ${exp.author.batch} student · anonymous`
    : `${exp.author.name} · ${exp.author.batch}`;

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
          <span className="text-fg">{title}</span>
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
                Submitted {pending.submittedAgo}. Placement Ops reviews
                first-in-first-out — we&apos;ll email you at{" "}
                <b className="text-fg">{user.sstEmail}</b> the moment it goes
                live. You can edit or withdraw it until then.
              </p>
            </div>
            <PendingActions expId={pending.id} />
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
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-fg-2">
              <span>{pending.companyName}</span>
              {pending.companyIndustry && (
                <>
                  <span className="size-[3px] rounded-full bg-fg-4" />
                  <span>{pending.companyIndustry}</span>
                </>
              )}
            </div>
            <div className="mt-[18px] flex items-center gap-3">
              <span className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-[13.5px] font-semibold text-white">
                {exp.author.anonymous ? "?" : initialsOf(exp.author.name, user.sstEmail)}
              </span>
              <div>
                <div className="text-[14.5px] font-semibold tracking-[-0.005em]">
                  {byline}
                </div>
                <div className="text-xs text-fg-3">SST · School of Technology</div>
              </div>
            </div>
          </header>

          {exp.overview && (
            <Section title="Overview" className="mt-0">
              <p className="m-0 text-[14.5px] leading-[1.65] text-fg-2">{exp.overview}</p>
            </Section>
          )}

          {questions.length > 0 && (
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
          )}

          {tips.length > 0 && (
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
          )}

          {exp.reflection && (
            <Section title="Reflections">
              <div className="relative rounded-lg border border-border bg-[linear-gradient(180deg,rgba(46,160,248,0.04),transparent_80%),var(--color-surface)] py-[22px] pl-7 pr-[22px]">
                <span className="absolute bottom-[18px] left-0 top-[18px] w-[3px] rounded-r-[3px] bg-gradient-to-b from-blue to-blue-deep shadow-[0_0_12px_var(--color-blue-glow)]" />
                <span className="pointer-events-none absolute right-[18px] top-3.5 select-none font-serif text-[48px] leading-none text-blue opacity-[0.18]">
                  &ldquo;
                </span>
                <p className="m-0 whitespace-pre-line text-[15px] leading-[1.7] tracking-[0.005em] text-fg">
                  {exp.reflection}
                </p>
              </div>
            </Section>
          )}
        </div>
      </main>
    </>
  );
}
