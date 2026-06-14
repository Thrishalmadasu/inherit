import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "@/components/icons";

// Shown when a signed-in account is not @sst.scaler.com - the code-level
// backstop to the Clerk dashboard domain allowlist.
export function RestrictedScreen({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full border border-red-border bg-red-soft text-red">
        <Icon.shield className="size-6" />
      </div>
      <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em]">
        Inherit is SST-only
      </h1>
      <p className="mx-auto mb-1 max-w-[440px] text-sm leading-[1.6] text-fg-2">
        <span className="font-medium text-fg">{email}</span> isn&apos;t an SST
        account. Sign in with your <span className="font-medium text-fg">@sst.scaler.com</span>{" "}
        Google account to continue.
      </p>
      <p className="mb-7 text-[12.5px] text-fg-3">
        Placement experiences stay inside the batch - permanently.
      </p>
      <SignOutButton redirectUrl="/sign-in">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:border-border-hover hover:bg-surface-3"
        >
          <Icon.arrow className="size-3.5" /> Sign out & try another account
        </button>
      </SignOutButton>
    </main>
  );
}
