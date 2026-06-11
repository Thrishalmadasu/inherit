"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { OutcomePill } from "@/components/ui/pill";
import type { CompanyListItem, Experience } from "@/lib/types";

// Large landing search with instant autocomplete (companies + experiences).
export function HeroSearch({
  companies,
  experiences,
}: {
  companies: CompanyListItem[];
  experiences: Experience[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return { companies: companies.slice(0, 4), exps: [] };
    return {
      companies: companies.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 4),
      exps: experiences
        .filter(
          (e) =>
            e.role.toLowerCase().includes(t) ||
            (e.round ?? "").toLowerCase().includes(t) ||
            (e.company ?? "").toLowerCase().includes(t),
        )
        .slice(0, 3),
    };
  }, [q, companies, experiences]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showPop = open && (matches.companies.length > 0 || matches.exps.length > 0);

  return (
    <div className="relative mx-auto max-w-[640px]">
      <Icon.search className="pointer-events-none absolute left-[18px] top-1/2 size-[18px] -translate-y-1/2 text-fg-3" />
      <input
        ref={inputRef}
        value={q}
        placeholder="Search by company, role, or round…"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }
        }}
        className={cnInput(open)}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md border border-border-strong bg-bg-2 px-2 py-1 font-mono text-[11.5px] text-fg-3">
        ⌘K
      </span>

      {showPop && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-border-strong bg-surface p-1.5 text-left shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7)]">
          {matches.companies.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-4">
                {q.trim() ? "Companies" : "Browse companies"}
              </div>
              {matches.companies.map((c) => (
                <Link
                  key={c.slug}
                  href={`/companies/${c.slug}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-sm text-fg transition-colors hover:bg-bg-2"
                >
                  <PopLogo>{c.name[0]}</PopLogo>
                  <span>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11.5px] text-fg-3">{c.industry}</div>
                  </span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-fg-3">
                    {c.count} experiences
                  </span>
                </Link>
              ))}
            </>
          )}

          {matches.exps.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-4">
                Experiences
              </div>
              {matches.exps.map((e) => (
                <Link
                  key={e.id}
                  href={`/experiences/${e.id}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-sm text-fg transition-colors hover:bg-bg-2"
                >
                  <PopLogo>{(e.company ?? "A")[0]}</PopLogo>
                  <span>
                    <div className="font-medium">
                      {e.role} · {e.round ?? e.rounds?.[0]?.round}
                    </div>
                    <div className="text-[11.5px] text-fg-3">
                      {e.company ?? "Amazon"} · {e.submittedAt}
                    </div>
                  </span>
                  <span className="ml-auto shrink-0">
                    {(e.outcome ?? e.overallOutcome) && (
                      <OutcomePill outcome={(e.outcome ?? e.overallOutcome)!} />
                    )}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PopLogo({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-lg border border-border-strong bg-surface-3 text-sm font-semibold">
      {children}
    </span>
  );
}

function cnInput(open: boolean) {
  const focusRing =
    "focus:border-blue-border focus:shadow-[0_0_0_4px_var(--color-blue-soft),0_14px_40px_-10px_rgba(0,0,0,0.5)]";
  const openRing = open
    ? "border-blue-border shadow-[0_0_0_4px_var(--color-blue-soft),0_14px_40px_-10px_rgba(0,0,0,0.5)]"
    : "border-border-strong";
  return `h-14 w-full rounded-[14px] border bg-surface pl-[50px] pr-16 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-3 ${openRing} ${focusRing}`;
}
