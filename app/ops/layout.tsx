import { redirect } from "next/navigation";
import { isOpsUser, requireDbUser, type DbUser } from "@/lib/auth";
import { countPending } from "@/lib/write/moderation";
import { OpsShell } from "@/components/ops/ops-shell";

// Server gate for everything under /ops — DB role (moderator/super_admin),
// with the OPS_EMAILS allowlist as a bootstrap OR-gate (lib/auth.isOpsUser).
// Roles are managed in /ops/users (super-admin only, audited).
// KNOWN GAP: the nav's "Switch to Ops view" item is driven by viewer.isOps,
// which covers OPS_EMAILS + SUPER_ADMIN_EMAILS but NOT a plain `moderator`
// promoted only via the DB — they can reach /ops by URL but won't see the nav
// link until also in OPS_EMAILS. Closing that fully means sourcing viewer.isOps
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
