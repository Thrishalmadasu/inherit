"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

const ITEM =
  "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium transition-colors [&_svg]:size-3.5";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 rounded-full border bg-surface py-1 pl-1 pr-2.5 transition-[border-color,background]",
          open ? "border-border-hover bg-surface-3" : "border-border hover:border-border-hover hover:bg-surface-3",
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-xs font-semibold text-white">
          TM
        </span>
        <span className="flex flex-col leading-[1.15]">
          <span className="text-[12.5px] font-medium">Thrishal M.</span>
          <span className="whitespace-nowrap text-[10.5px] tracking-[0.02em] text-fg-3">
            STUDENT · &apos;27
          </span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[35] min-w-[230px] rounded-xl border border-border-strong bg-surface p-1.5 shadow-[0_20px_50px_-8px_rgba(0,0,0,0.6)]"
        >
          <div className="mb-1.5 border-b border-border px-3 pb-3 pt-2.5">
            <div className="text-[13.5px] font-semibold tracking-[-0.005em]">
              Thrishal M. · &apos;27
            </div>
            <div className="mt-px text-[11.5px] text-fg-3">
              thrishal.23bcs10115@sst.scaler.com
            </div>
          </div>
          <Link href="/me" className={cn(ITEM, "text-fg hover:bg-bg-2 [&_svg]:text-fg-3 hover:[&_svg]:text-fg")}>
            <Icon.bookmark /> My posts
          </Link>
          <Link href="#" className={cn(ITEM, "text-fg hover:bg-bg-2 [&_svg]:text-fg-3 hover:[&_svg]:text-fg")}>
            <Icon.user /> Account settings
          </Link>
          <div className="mx-1 my-1.5 h-px bg-border" />
          <Link
            href="/ops/queue"
            className={cn(ITEM, "text-[#b196f8] hover:bg-[rgba(122,90,224,0.1)] hover:text-[#c5a9ff] [&_svg]:text-[#a486f5]")}
          >
            <Icon.shield /> Switch to Ops view
          </Link>
          <div className="mx-1 my-1.5 h-px bg-border" />
          <button type="button" className={cn(ITEM, "text-red hover:bg-red-soft [&_svg]:text-red")}>
            <Icon.arrow /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
