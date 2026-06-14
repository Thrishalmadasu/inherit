import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/brand";

export const metadata: Metadata = { title: "SST Inherit" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="flex flex-col items-center text-center">
        <BrandMark className="mb-4 size-14" priority />
        <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">SST Inherit</h1>
        <p className="max-w-[380px] text-sm leading-[1.6] text-fg-2">
          Every OA, interview, and offer your batchmates have been through -
          searchable in one place.
        </p>
      </header>

      <SignIn path="/sign-in" />

      <p className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <Icon.shield className="size-3.5" />
        SST-only - sign in with your @sst.scaler.com Google account.
      </p>
    </main>
  );
}
