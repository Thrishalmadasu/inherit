"use server";
// Role management endpoints - SUPER ADMIN only. The action layer enforces the
// gate; the core re-asserts it (defense in depth).
import { requireSuperAdmin } from "@/lib/auth";
import { changeRoleCore } from "@/lib/write/roles";
import { runActionData, type ActionDataResult } from "@/lib/write/run";

export async function changeUserRole(
  targetUserId: string,
  toRole: string,
  reason?: string,
): Promise<ActionDataResult<{ name: string; fromRole: string; toRole: string }>> {
  const actor = await requireSuperAdmin();
  return runActionData(() => changeRoleCore(actor, targetUserId, toRole, reason));
}
