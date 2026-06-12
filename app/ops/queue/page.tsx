import { getOpsQueue, listOpsPublished } from "@/lib/db/queries";
import { OpsQueueView } from "@/components/ops/queue-view";

// Moderation queue — real pending rows, FIFO by created_at (PRD §10: no
// fast-tracking; resubmissions re-stamp created_at and join the back).
export default async function OpsQueuePage() {
  const [queue, published] = await Promise.all([getOpsQueue(), listOpsPublished()]);
  return <OpsQueueView queue={queue} published={published} />;
}
