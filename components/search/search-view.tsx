"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { OutcomePill } from "@/components/ui/pill";
import { Author } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { companies, experiences } from "@/lib/mock/data";

const RECENT_TERMS = ["Amazon", "SDE Intern", "Behavioural", "OA"];

function highlight(text: string, q: string): ReactNode {
  if (!q || !text) return text;
  const parts = String(text).split(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
  );
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="rounded-[3px] bg-[rgba(46,160,248,0.22)] px-0.5 text-fg">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

export function SearchView({ initialQ }: { initialQ: string }) {
  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState<"all" | "companies" | "experiences">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return { companies: [], experiences: [] };
    return {
      companies: companies.filter(
        (c) => c.name.toLowerCase().includes(t) || c.industry.toLowerCase().includes(t),
      ),
      experiences: experiences.filter(
        (e) =>
          (e.role && e.role.toLowerCase().includes(t)) ||
          "amazon".includes(t) ||
          (e.round && e.round.toLowerCase().includes(t)),
      ),
    };
  }, [q]);

  const totals = {
    all: results.companies.length + results.experiences.length,
    companies: results.companies.length,
    experiences: results.experiences.length,
  };
  const show = (kind: "companies" | "experiences") => tab === "all" || tab === kind;
  const term = q.trim();

  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[880px] px-7 pb-20 pt-7">
        {/* Big input */}
        <div className="relative mb-[22px]">
          <Icon.search className="pointer-events-none absolute left-[17px] top-1/2 size-[18px] -translate-y-1/2 text-fg-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company, role, or round…"
            className="h-[52px] w-full rounded-xl border border-border-strong bg-surface pl-[50px] pr-3.5 text-base text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_4px_var(--color-blue-soft)]"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              title="Clear"
              className="absolute right-3 top-1/2 grid size-[26px] -translate-y-1/2 place-items-center rounded-full bg-bg-2 text-fg-3 hover:text-fg"
            >
              <Icon.x className="size-3" />
            </button>
          )}
        </div>

        {/* Tabs */}
        {term && (
          <div className="mb-[18px] flex gap-1 border-b border-border">
            {(["all", "companies", "experiences"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] font-medium capitalize transition-colors",
                  tab === t
                    ? "text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-[1px] after:bg-blue after:shadow-[0_0_8px_var(--color-blue-glow)] after:content-['']"
                    : "text-fg-2 hover:text-fg",
                )}
              >
                {t === "all" ? "All" : t === "companies" ? "Companies" : "Experiences"}
                <span className="rounded-full bg-surface-3 px-[7px] py-px text-[11px] tabular-nums text-fg-3">
                  {totals[t]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Results / empty states */}
        {!term ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-[60px] text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              Start typing to search across SST
            </strong>
            Find a company, a role, or a specific interview round — results appear
            from keystroke 1.
            <div className="mt-3.5 flex flex-wrap justify-center gap-2">
              <span className="mr-1 text-xs text-fg-3">Recent</span>
              {RECENT_TERMS.map((t) => (
                <button
                  key={t}
                  onClick={() => setQ(t)}
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-fg-2 hover:border-border-hover hover:text-fg"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : totals.all === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong px-5 py-[60px] text-center text-fg-3">
            <strong className="mb-1.5 block font-semibold text-fg">
              No results for &ldquo;{q}&rdquo;
            </strong>
            Try fewer keywords — or check your spelling.
          </div>
        ) : (
          <>
            {show("companies") && results.companies.length > 0 && (
              <SearchSection title="Companies" href="/companies">
                {results.companies.slice(0, tab === "all" ? 3 : 50).map((c) => (
                  <Row key={c.slug} href={`/companies/${c.slug}`} logo={c.name[0]}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                      <b className="font-semibold">{highlight(c.name, term)}</b>
                      <span className="font-normal text-fg-3">·</span>
                      <span className="text-fg-2">{highlight(c.industry, term)}</span>
                    </div>
                    <div className="text-xs text-fg-3">
                      {c.count} experiences · Latest{" "}
                      {c.lastDays === 0 ? "today" : `${c.lastDays}d ago`}
                    </div>
                  </Row>
                ))}
              </SearchSection>
            )}

            {show("experiences") && results.experiences.length > 0 && (
              <SearchSection title="Experiences" href="/feed">
                {results.experiences.slice(0, tab === "all" ? 4 : 50).map((e) => (
                  <Row key={e.id} href={`/experiences/${e.id}`} logo="A">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                      <b className="font-semibold">Amazon</b>
                      <span className="font-normal text-fg-3">·</span>
                      <span className="text-fg-2">
                        {highlight(e.role, term)} · {highlight(e.round ?? "", term)}
                      </span>
                      {e.outcome && <OutcomePill outcome={e.outcome} />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-fg-3">
                      <Author author={e.author} />
                    </div>
                  </Row>
                ))}
              </SearchSection>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SearchSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2.5 flex items-baseline justify-between text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
        {title}
        <Link
          href={href}
          className="whitespace-nowrap text-xs font-medium normal-case tracking-normal text-fg-2 hover:text-blue"
        >
          Browse all →
        </Link>
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({
  href,
  logo,
  children,
}: {
  href: string;
  logo: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[38px_1fr] items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 transition-[border-color,background] hover:border-border-hover hover:bg-surface-3"
    >
      <div className="grid size-[38px] place-items-center rounded-[9px] border border-border-strong bg-bg-2 text-[15px] font-bold">
        {logo}
      </div>
      <div className="min-w-0">{children}</div>
    </Link>
  );
}
