import { redirect } from "next/navigation";
import { isOpsUser, requireDbUser, type DbUser } from "@/lib/auth";
import { countPending } from "@/lib/write/moderation";
import { OpsShell } from "@/components/ops/ops-shell";

// Server gate for everything under /ops — DB role (moderator/super_admin),
// with the OPS_EMAILS allowlist as a bootstrap OR-gate (lib/auth.isOpsUser).
// NOTE: the nav's "Switch to Ops view" item is still env-driven via Clerk
// publicMetadata (cosmetic); DB-promoted moderators should also be added to
// OPS_EMAILS until the role-management UI lands.
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
