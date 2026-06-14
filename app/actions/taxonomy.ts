"use server";
// Ops taxonomy-management endpoints (concern #10). Moderator+ only - managing
// the canonical companies / round types / topics shapes every student's
// choices and a merge moves real data. The action layer enforces the gate; the
// cores re-assert it (defense in depth).
import { requireModerator } from "@/lib/auth";
import {
  addCompanyAliasCore,
  addCompanyCore,
  addRoundTypeCore,
  addTopicCore,
  mergeCompaniesCore,
  renameCompanyCore,
  renameRoundTypeCore,
  renameTopicCore,
  setRoundTypeActiveCore,
  setTopicActiveCore,
} from "@/lib/write/taxonomy";
import { runAction, runActionData, type ActionDataResult, type ActionResult } from "@/lib/write/run";

type TagCategory = "dsa" | "system_design" | "behavioral" | "tooling" | "domain" | "other";

// ── Companies ──
export async function addCompany(input: {
  name: string;
  industry?: string;
  location?: string;
}): Promise<ActionDataResult<{ id: string; name: string }>> {
  const actor = await requireModerator();
  return runActionData(() => addCompanyCore(actor, input));
}

export async function renameCompany(
  id: string,
  input: { name: string; industry?: string; location?: string },
): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => renameCompanyCore(actor, id, input));
}

export async function addCompanyAlias(id: string, alias: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => addCompanyAliasCore(actor, id, alias));
}

export async function mergeCompanies(
  sourceId: string,
  targetId: string,
): Promise<ActionDataResult<{ target: string; moved: number }>> {
  const actor = await requireModerator();
  return runActionData(() => mergeCompaniesCore(actor, sourceId, targetId));
}

// ── Round types ──
export async function addRoundType(label: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => addRoundTypeCore(actor, label));
}

export async function renameRoundType(id: string, label: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => renameRoundTypeCore(actor, id, label));
}

export async function setRoundTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => setRoundTypeActiveCore(actor, id, isActive));
}

// ── Topics ──
export async function addTopic(input: {
  label: string;
  category: TagCategory;
}): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => addTopicCore(actor, input));
}

export async function renameTopic(id: string, label: string): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => renameTopicCore(actor, id, label));
}

export async function setTopicActive(id: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireModerator();
  return runAction(() => setTopicActiveCore(actor, id, isActive));
}
