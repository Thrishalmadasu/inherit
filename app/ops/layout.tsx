import { redirect } from "next/navigation";
import { isOpsUser, requireDbUser, type DbUser } from "@/lib/auth";
import { countPending } from "@/lib/write/moderation";
import { OpsShell } from "@/components/ops/ops-shell";

// Server gate for everything under /ops - DB role (moderator/super_admin),
// with the OPS_EMAILS allowlist as a bootstrap OR-gate (lib/auth.isOpsUser).
// Roles are managed in /ops/users (super-admin only, audited).
// The nav's "Switch to Ops view" item is driven by viewer.isOps, which
// ensureDbUser now sources from the DB ROLE (isOpsUser) - so a moderator
// promoted purely via /ops/users sees the link without being in OPS_EMAILS.
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
