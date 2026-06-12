import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { HeroSearch } from "@/components/hero-search";
import { Icon } from "@/components/icons";
import { OutcomePill } from "@/components/ui/pill";
import { Author } from "@/components/ui/primitives";
import { requireDbUser } from "@/lib/auth";
import { getMyPendingPost, latestExperiences, listCompanies } from "@/lib/db/queries";
import type { CompanyListItem, Experience } from "@/lib/types";

export const dynamic = "force-dynamic"; // always reflect the latest DB rows

const QUICK = [
  { q: "Amazon", label: "Amazon" },
  { q: "Microsoft", label: "Microsoft" },
  { q: "SDE Intern", label: "SDE Intern" },
  { q: "Behavioral", label: "Behavioural" },
];

function timeAgo(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default async function DashboardPage() {
  const user = await requireDbUser();
  const [companies, experiences, pending] = await Promise.all([
    listCompanies(),
    latestExperiences(6),
    getMyPendingPost(user.id),
  ]);

  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[1080px] px-7 pb-20 pt-7">
        {/* Hero */}
        <div className="py-10 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
            SST Placement Knowledge Base
          </div>
          <h1 className="mb-2.5 text-[36px] font-bold leading-[1.15] tracking-[-0.03em]">
            What are you prepping for <span className="text-blue">today?</span>
          </h1>
          <p className="mb-6 text-[15px] leading-[1.55] text-fg-2">
            Every OA, interview, and offer your batchmates have been through —
            searchable in one place.
          </p>
          <HeroSearch companies={companies} experiences={experiences} />
          <div className="mt-[18px] flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-fg-3">Try</span>
            {QUICK.map((c) => (
              <Link
                key={c.q}
                href={`/search?q=${encodeURIComponent(c.q)}`}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-fg-2 transition-[border-color,color] hover:border-border-hover hover:text-fg"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Your posts strip — only when the signed-in user has a pending post */}
        {pending && (
          <Link
            href="/under-review"
            className="mt-9 flex items-center gap-3.5 rounded-lg border border-border bg-surface px-[18px] py-3.5 transition-[border-color,background] hover:border-border-hover hover:bg-surface-3"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-blue-border bg-blue-soft text-blue">
              <Icon.doc className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[13.5px] font-semibold tracking-[-0.005em]">
                Your {pending.companyName} {pending.exp.round ?? ""} submission is
                under review
              </div>
              <div className="text-[12.5px] text-fg-3">
                Submitted {pending.submittedAgo} · we&apos;ll email you the moment
                it&apos;s live
              </div>
            </div>
            <span className="inline-flex h-[22px] items-center gap-[5px] rounded-full border border-blue-border bg-blue-soft px-2.5 text-[11.5px] font-medium text-blue">
              <span className="size-1.5 rounded-full bg-current" />
              Under Review
            </span>
            <Icon.arrow className="size-3.5 text-fg-3" />
          </Link>
        )}

        {/* Latest across SST */}
        <Section title="Latest across SST" href="/feed">
          <div className="flex flex-col gap-2">
            {experiences.map((e) => (
              <FeedRow key={e.id} e={e} companyName={e.company ?? "—"} />
            ))}
          </div>
        </Section>

        {/* Companies */}
        <Section title="Companies hiring this cycle" href="/companies">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {companies.slice(0, 8).map((c) => (
              <CompanyTile key={c.slug} co={c} />
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-3.5 flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[13px] text-fg-2 transition-colors hover:text-blue [&_svg]:size-3"
        >
          See all
          <Icon.arrow />
        </Link>
      </div>
      {children}
    </section>
  );
}

function FeedRow({ e, companyName }: { e: Experience; companyName: string }) {
  return (
    <Link
      href={`/experiences/${e.id}`}
      className="grid grid-cols-[38px_1fr_auto] items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 transition-[border-color,background] hover:border-border-hover hover:bg-surface-3"
    >
      <div className="grid size-[38px] place-items-center rounded-[9px] border border-border-strong bg-bg-2 text-[15px] font-bold">
        {companyName[0]}
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium tracking-[-0.005em]">
          <b className="font-semibold">{companyName}</b>
          <span className="font-normal text-fg-3">·</span>
          <span className="text-fg-2">
            {e.role} · {e.round ?? e.rounds?.map((r) => r.round).join(" → ")}
          </span>
          {(e.outcome ?? e.overallOutcome) && (
            <OutcomePill outcome={(e.outcome ?? e.overallOutcome)!} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
          <Author author={e.author} />
        </div>
      </div>
      <div className="whitespace-nowrap text-xs text-fg-3">{e.submittedAt}</div>
    </Link>
  );
}

function CompanyTile({ co }: { co: CompanyListItem }) {
  return (
    <Link
      href={`/companies/${co.slug}`}
      className="block rounded-lg border border-border bg-surface px-4 pb-3.5 pt-4 transition-[border-color,background,transform] hover:border-border-hover hover:bg-surface-3 active:translate-y-[0.5px]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="grid size-[38px] place-items-center rounded-md border border-border-strong bg-bg-2 text-[15px] font-bold tracking-[-0.02em]">
          {co.name[0]}
        </div>
        {co.active && (
          <span className="inline-flex items-center gap-[5px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-green">
            <span className="size-1.5 rounded-full bg-green shadow-[0_0_8px_var(--color-green)]" />
            Recruiting
          </span>
        )}
      </div>
      <div className="mb-0.5 text-[14.5px] font-semibold tracking-[-0.01em]">
        {co.name}
      </div>
      <div className="mb-3 truncate text-xs text-fg-3">{co.industry}</div>
      <div className="flex items-baseline justify-between border-t border-border pt-2.5 text-xs text-fg-3">
        <span>
          <span className="text-sm font-semibold text-fg">{co.count}</span>{" "}
          experiences
        </span>
        <span>{timeAgo(co.lastDays)}</span>
      </div>
    </Link>
  );
}
