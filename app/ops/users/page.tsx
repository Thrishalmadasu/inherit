import { isSuperAdmin, requireDbUser } from "@/lib/auth";
import { listOpsUsers, listRecentRoleChanges } from "@/lib/db/queries";
import { UsersView } from "@/components/ops/users-view";

export const dynamic = "force-dynamic";

// Super-Admin user management. The page renders for any Ops user (so they can
// see who holds what), but role changes are gated to super admins — the role
// <Select> is disabled otherwise and the Server Action re-checks regardless.
export default async function OpsUsersPage(props: PageProps<"/ops/users">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = typeof sp.page === "string" ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;

  const [viewer, data, audit] = await Promise.all([
    requireDbUser(),
    listOpsUsers({ q, page }),
    listRecentRoleChanges(),
  ]);

  return <UsersView canManage={isSuperAdmin(viewer)} q={q} data={data} audit={audit} />;
}
