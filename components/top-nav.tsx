"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "/companies", label: "Companies", match: "/companies" },
  { href: "/feed", label: "All experiences", match: "/feed" },
  { href: "/me", label: "My posts", match: "/me" },
];

export function TopNav({ showSearch = true }: { showSearch?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the global search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-[rgba(6,8,15,0.78)] backdrop-blur-[14px] backdrop-saturate-[1.6]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-5 px-7 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]"
        >
          <BrandMark className="size-[26px]" priority />
          SST Inherit
        </Link>

        <span className="h-[18px] w-px bg-border-strong max-md:hidden" />

        <div className="flex items-center gap-0.5 max-md:hidden">
          {SECTIONS.map((s) => {
            const active = pathname.startsWith(s.match);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "relative inline-flex h-[34px] items-center whitespace-nowrap rounded-[8px] px-3.5 text-[13.5px] font-medium transition-[background,color] duration-150",
                  active
                    ? "bg-surface text-fg after:absolute after:inset-x-3.5 after:-bottom-2.5 after:h-0.5 after:rounded-[1px] after:bg-blue after:shadow-[0_0_8px_var(--color-blue-glow)] after:content-['']"
                    : "text-fg-2 hover:bg-surface hover:text-fg",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        <span className="flex-1" />

        {showSearch && (
          <form
            className="relative w-80 max-lg:hidden"
            onSubmit={(e) => {
              e.preventDefault();
              const v = searchRef.current?.value.trim() ?? "";
              router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search");
            }}
          >
            <Icon.search className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-fg-3" />
            <input
              ref={searchRef}
              placeholder="Search by company, role, or round…"
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[5px] border border-border-strong bg-bg-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-3">
              ⌘K
            </span>
          </form>
        )}

        <Button href="/share" variant="primary">
          <Icon.plus />
          Share experience
        </Button>

        <UserMenu />
      </div>
    </nav>
  );
}
