import { redirect } from "next/navigation";
import { isSuperAdmin, requireDbUser } from "@/lib/auth";
import { listOpsUsers, listRecentRoleChanges } from "@/lib/db/queries";
import { UsersView } from "@/components/ops/users-view";

export const dynamic = "force-dynamic";

// Super-Admin ONLY. Role/user management is a super-admin concern, so a
// moderator can't even view this tab - they're redirected to the queue (the
// nav also hides the link, and changeUserRole re-checks via requireSuperAdmin).
export default async function OpsUsersPage(props: PageProps<"/ops/users">) {
  const viewer = await requireDbUser();
  if (!isSuperAdmin(viewer)) redirect("/ops/queue");

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = typeof sp.page === "string" ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;

  const [data, audit] = await Promise.all([
    listOpsUsers({ q, page }),
    listRecentRoleChanges(),
  ]);

  // Only super admins reach here, so management is always enabled.
  return <UsersView canManage q={q} data={data} audit={audit} />;
}
