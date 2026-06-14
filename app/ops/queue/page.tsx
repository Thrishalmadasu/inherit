import { isModerator, requireDbUser } from "@/lib/auth";
import { getOpsQueue, listOpsPublished } from "@/lib/db/queries";
import { OpsQueueView } from "@/components/ops/queue-view";

// Moderation queue - real pending rows, FIFO by created_at (PRD §10: no
// fast-tracking; resubmissions re-stamp created_at and join the back).
export default async function OpsQueuePage() {
  const [user, queue, anonymous, published] = await Promise.all([
    requireDbUser(),
    getOpsQueue({ page: 1 }),
    getOpsQueue({ anonymousOnly: true, page: 1 }),
    listOpsPublished({ page: 1 }),
  ]);
  return (
    <OpsQueueView
      queue={queue}
      anonymous={anonymous}
      published={published}
      canModerate={isModerator(user)}
    />
  );
}
