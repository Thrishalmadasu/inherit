"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { opsQueue } from "@/lib/mock/data";

const TABS = [
  { href: "/ops/queue", label: "Moderation queue", count: opsQueue.length },
  { href: "/ops/invite", label: "Invite to share" },
  { href: "/ops/users", label: "Users" },
];

// Ops shell — tonight this is open; the OPS_EMAILS gate lands with Clerk (Step 4).
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[1280px] px-7 pb-20 pt-6">
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5 border-b border-border pb-[22px]">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">
                Placement Ops
              </h1>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[rgba(122,90,224,0.35)] bg-[rgba(122,90,224,0.13)] px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#b196f8]">
                <Icon.shield className="size-3" />
                Ops
              </span>
            </div>
            <p className="m-0 text-sm text-fg-2">
              Moderation queue and outreach for the &apos;27 placement cycle.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border bg-surface p-[3px]">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3.5 py-[7px] text-[13px] font-medium transition-colors",
                    active
                      ? "bg-bg-2 text-fg shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
                      : "text-fg-2 hover:text-fg",
                  )}
                >
                  {t.label}
                  {t.count != null && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                        active ? "bg-blue-soft text-blue" : "bg-surface-3 text-fg-3",
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </main>
    </>
  );
}
