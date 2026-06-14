"use server";
// Read endpoints for the share-form typeaheads (company + role). Signed-in
// only. Both search the canonical DB lists and cap at 5 results; an unmatched
// typed value is allowed through as a proposal, resolved by Ops at review.
import { requireDbUser } from "@/lib/auth";
import { searchCompanies, searchRoleTypes } from "@/lib/db/queries";

export async function searchCompanyOptions(
  q: string,
): Promise<{ id: string; name: string; industry: string }[]> {
  await requireDbUser();
  return searchCompanies(q, 5);
}

export async function searchRoleOptions(q: string): Promise<{ id: string; label: string }[]> {
  await requireDbUser();
  return searchRoleTypes(q, 5);
}
