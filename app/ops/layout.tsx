import { redirect } from "next/navigation";
import { isOpsUser, requireDbUser, type DbUser } from "@/lib/auth";
import { countPending } from "@/lib/write/moderation";
import { OpsShell } from "@/components/ops/ops-shell";

// Server gate for everything under /ops — DB role (moderator/super_admin),
// with the OPS_EMAILS allowlist as a bootstrap OR-gate (lib/auth.isOpsUser).
// Roles are managed in /ops/users (super-admin only, audited).
// KNOWN GAP: the nav's "Switch to Ops view" item is still driven by
// viewer.isOps = isOpsEmail (Clerk publicMetadata fast-path), so a moderator
// promoted ONLY via the DB can reach /ops by URL but won't see the nav link
// until they're also in OPS_EMAILS. Closing that means sourcing viewer.isOps
// from the DB role in ensureDbUser — deferred (it reworks the metadata cache).
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  let user: DbUser;
  try {
    user = await requireDbUser();
  } catch {
    redirect("/");
  }
  if (!isOpsUser(user)) redirect("/");
  return <OpsShell pendingCount={await countPending()}>{children}</OpsShell>;
}
