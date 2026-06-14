// Write core for role management (PRD §10 - Ops/admin). Same contract as the
// other cores: explicit actor (testable without Clerk), no "use server", one
// db.batch() so the role change and its audit row land together or not at all.
//
// Authorization is enforced at the action layer (requireSuperAdmin) AND
// re-asserted here - the core takes an explicit actor and must never trust the
// caller to have checked. Only a super admin can change roles.
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { isSuperAdmin, type DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";

export type Role = (typeof s.userRole.enumValues)[number];

const isRole = (v: string): v is Role => (s.userRole.enumValues as readonly string[]).includes(v);

export async function changeRoleCore(
  actor: DbUser,
  targetUserId: string,
  toRole: string,
  reason?: string,
): Promise<{ name: string; fromRole: Role; toRole: Role }> {
  if (!isSuperAdmin(actor)) throw new WriteError("Only super admins can change roles");
  if (!isRole(toRole)) throw new WriteError("Unknown role");

  const [target] = await db.select().from(s.users).where(eq(s.users.id, targetUserId));
  if (!target) throw new WriteError("User not found");

  const fromRole = target.role;
  if (fromRole === toRole) throw new WriteError(`Already a ${toRole.replace("_", " ")}`);

  // Lockout guard: never demote the last super admin - that would leave nobody
  // able to manage roles (the SUPER_ADMIN_EMAILS bootstrap aside, which is meant
  // to be removed once roles are seeded).
  if (fromRole === "super_admin" && toRole !== "super_admin") {
    const admins = await db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.role, "super_admin"));
    if (admins.length <= 1)
      throw new WriteError("Can't demote the last super admin - promote someone else first");
  }

  await db.batch([
    db.update(s.users).set({ role: toRole }).where(eq(s.users.id, targetUserId)),
    db.insert(s.roleChangeAudit).values({
      changedUserId: targetUserId,
      changedByUserId: actor.id,
      fromRole,
      toRole,
      reason: reason?.trim() || null,
    }),
  ]);

  return { name: target.name, fromRole, toRole };
}
