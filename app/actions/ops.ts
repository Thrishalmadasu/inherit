"use server";
// Read endpoints for the paginated Ops queue + published lists ("Load more").
// Ops-gated, like the rest of /ops.
import { requireOps } from "@/lib/auth";
import { getOpsQueue, listOpsPublished, type Paginated } from "@/lib/db/queries";
import type { OpsPublishedItem, OpsQueueItem } from "@/lib/types";

export async function fetchOpsQueue(opts: {
  anonymousOnly?: boolean;
  page?: number;
}): Promise<Paginated<OpsQueueItem>> {
  await requireOps();
  return getOpsQueue(opts);
}

export async function fetchOpsPublished(opts: {
  page?: number;
}): Promise<Paginated<OpsPublishedItem>> {
  await requireOps();
  return listOpsPublished(opts);
}
