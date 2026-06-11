import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Sign up — Inherit" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="flex flex-col items-center text-center">
        <div className="mb-4 grid size-12 place-items-center rounded-[12px] bg-gradient-to-b from-[#2ea0f8] to-[#0b66b8] shadow-[0_0_0_1px_rgba(46,160,248,0.4),0_8px_28px_-4px_rgba(46,160,248,0.45)]">
          <Icon.shield className="size-6 text-white" />
        </div>
        <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">Inherit</h1>
        <p className="max-w-[380px] text-sm leading-[1.6] text-fg-2">
          Built by the batch, for the batches that follow.
        </p>
      </header>

      <SignUp path="/sign-up" />

      <p className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <Icon.shield className="size-3.5" />
        SST-only — use your @sst.scaler.com Google account.
      </p>
    </main>
  );
}
