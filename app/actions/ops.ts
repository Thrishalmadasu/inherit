"use server";
// Read endpoints for the paginated Ops queue + published lists ("Load more").
// Ops-gated, like the rest of /ops.
import { requireOps } from "@/lib/auth";
import {
  getOpsQueue,
  listOpsPublished,
  searchCompanies,
  searchRoleTypes,
  type Paginated,
} from "@/lib/db/queries";
import type { OpsPublishedItem, OpsQueueItem } from "@/lib/types";

// Canonical-company typeahead for resolving a proposed company in review.
export async function searchCompaniesForResolve(
  q: string,
): Promise<{ id: string; name: string; industry: string }[]> {
  await requireOps();
  return searchCompanies(q);
}

// Canonical-role typeahead for resolving a proposed role in review.
export async function searchRoleTypesForResolve(
  q: string,
): Promise<{ id: string; label: string }[]> {
  await requireOps();
  return searchRoleTypes(q);
}

export async function fetchOpsQueue(opts: {
  anonymousOnly?: boolean;
  page?: number;
  q?: string;
}): Promise<Paginated<OpsQueueItem>> {
  await requireOps();
  return getOpsQueue(opts);
}

export async function fetchOpsPublished(opts: {
  page?: number;
  q?: string;
}): Promise<Paginated<OpsPublishedItem>> {
  await requireOps();
  return listOpsPublished(opts);
}
