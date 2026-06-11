import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isOpsEmail } from "@/lib/auth";
import { OpsShell } from "@/components/ops/ops-shell";

// Server gate for everything under /ops — OPS_EMAILS allowlist for now,
// DB-backed roles when the write loop lands (Session 2).
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isOpsEmail(email)) redirect("/");
  return <OpsShell>{children}</OpsShell>;
}
