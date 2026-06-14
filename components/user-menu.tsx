"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useViewer } from "@/lib/viewer";
import { batchLabelFromEmail, initialsOf, shortName } from "@/lib/user-display";

const ITEM =
  "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium transition-colors [&_svg]:size-3.5";

const ROLE_LABEL: Record<string, string> = {
  student: "STUDENT",
  moderator: "MODERATOR",
  super_admin: "SUPER ADMIN",
};

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Server-resolved identity DTO (lib/viewer) - not Clerk's useUser(), so the
  // byline renders identically under real sessions and dev impersonation.
  const viewer = useViewer();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  // The proxy guarantees a session on every app route; null only on the
  // signed-out routes, which don't render the nav.
  if (!viewer) return <div className="h-9 w-[140px]" aria-hidden />;

  const { email, isOps } = viewer;
  const name = shortName(viewer.name, email);
  const batch = batchLabelFromEmail(email);

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
        {viewer.imageUrl ? (
          <Image
            src={viewer.imageUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-blue to-blue-deep text-xs font-semibold text-white">
            {initialsOf(viewer.name, email)}
          </span>
        )}
        <span className="flex flex-col leading-[1.15]">
          <span className="text-[12.5px] font-medium">{name}</span>
          <span className="whitespace-nowrap text-[10.5px] tracking-[0.02em] text-fg-3">
            {ROLE_LABEL[viewer.role] ?? "STUDENT"}
            {batch && ` · ${batch}`}
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
              {name}
              {batch && ` · ${batch}`}
            </div>
            <div className="mt-px text-[11.5px] text-fg-3">{email}</div>
          </div>
          <Link href="/me" className={cn(ITEM, "text-fg hover:bg-bg-2 [&_svg]:text-fg-3 hover:[&_svg]:text-fg")}>
            <Icon.bookmark /> My posts
          </Link>
          {isOps && (
            <>
              <div className="mx-1 my-1.5 h-px bg-border" />
              <Link
                href="/ops/queue"
                className={cn(ITEM, "text-[#b196f8] hover:bg-[rgba(122,90,224,0.1)] hover:text-[#c5a9ff] [&_svg]:text-[#a486f5]")}
              >
                <Icon.shield /> Switch to Ops view
              </Link>
            </>
          )}
          <div className="mx-1 my-1.5 h-px bg-border" />
          {viewer.dev ? (
            <button
              type="button"
              onClick={() => (window.location.href = "/dev-login?off")}
              className={cn(ITEM, "text-red hover:bg-red-soft [&_svg]:text-red")}
            >
              <Icon.arrow /> Sign out
            </button>
          ) : (
            <ClerkSignOutButton />
          )}
        </div>
      )}
    </div>
  );
}

// Separate component so useClerk() is only called when ClerkProvider exists -
// under dev impersonation the layout doesn't mount Clerk at all (§7).
function ClerkSignOutButton() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: "/sign-in" })}
      className={cn(ITEM, "text-red hover:bg-red-soft [&_svg]:text-red")}
    >
      <Icon.arrow /> Sign out
    </button>
  );
}
