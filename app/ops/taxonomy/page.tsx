import { isModerator, requireDbUser } from "@/lib/auth";
import { listOpsCompanies, listOpsRoundTypes, listOpsTopics } from "@/lib/db/queries";
import { TaxonomyView } from "@/components/ops/taxonomy-view";

export const dynamic = "force-dynamic";

// Canonical-entity management (concern #10): companies, round types, topics.
// Any Ops user can view; mutations are gated to moderators (the <View> hides
// the controls and the Server Actions re-check via requireModerator).
export default async function OpsTaxonomyPage() {
  const [viewer, companies, roundTypes, topics] = await Promise.all([
    requireDbUser(),
    listOpsCompanies(),
    listOpsRoundTypes(),
    listOpsTopics(),
  ]);
  return (
    <TaxonomyView
      canManage={isModerator(viewer)}
      companies={companies}
      roundTypes={roundTypes}
      topics={topics}
    />
  );
}
