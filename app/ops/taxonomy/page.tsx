import { isModerator, requireDbUser } from "@/lib/auth";
import {
  listOpsCompanies,
  listOpsRoleTypes,
  listOpsRoundTypes,
  listOpsTopics,
} from "@/lib/db/queries";
import { TaxonomyView } from "@/components/ops/taxonomy-view";

export const dynamic = "force-dynamic";

// Canonical-entity management (concern #10): companies, round types, roles,
// topics. Any Ops user can view; mutations are gated to moderators (the <View>
// hides the controls and the Server Actions re-check via requireModerator).
// Companies are paginated server-side (can grow); the small bounded round/role/
// topic lists ship in full with a client filter.
export default async function OpsTaxonomyPage() {
  const [viewer, companies, roundTypes, roleTypes, topics] = await Promise.all([
    requireDbUser(),
    listOpsCompanies({ page: 1 }),
    listOpsRoundTypes(),
    listOpsRoleTypes(),
    listOpsTopics(),
  ]);
  return (
    <TaxonomyView
      canManage={isModerator(viewer)}
      companies={companies}
      roundTypes={roundTypes}
      roleTypes={roleTypes}
      topics={topics}
    />
  );
}
