// Write cores for the Ops-managed canonical vocabularies (concern #10):
// companies, round types, and topic tags. Same contract as the other cores -
// explicit actor (re-asserts authorization), no "use server", one db.batch()
// per multi-statement mutation. These are the ONLY way new canonical entries
// are created (students never introduce them), so duplicates are prevented at
// the root rather than cleaned up after the fact.
//
// Gate: managing the canonical taxonomy is a moderator+ action (it shapes every
// student's choices and a merge moves real data). The action layer enforces
// requireModerator; the cores re-assert isModerator (defense in depth).
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { isModerator, type DbUser } from "@/lib/auth";
import { WriteError } from "@/lib/write/experiences";

type Batchable = Parameters<typeof db.batch>[0][number];

const slugify = (x: string) =>
  x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function assertMod(actor: DbUser) {
  if (!isModerator(actor)) throw new WriteError("Moderator access required");
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "item";
  let slug = root;
  for (let i = 2; ; i++) {
    const [clash] = await db
      .select({ id: s.companies.id })
      .from(s.companies)
      .where(exceptId ? and(eq(s.companies.slug, slug), ne(s.companies.id, exceptId)) : eq(s.companies.slug, slug));
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
}

// ── Companies ────────────────────────────────────────────────────────────────
async function findCompanyByNameOrAlias(name: string, exceptId?: string) {
  const [hit] = await db
    .select({ id: s.companies.id, name: s.companies.name })
    .from(s.companies)
    .where(
      and(
        sql`lower(${s.companies.name}) = ${name.toLowerCase()}
            or exists (select 1 from unnest(${s.companies.aliases}) a where lower(a) = ${name.toLowerCase()})`,
        exceptId ? ne(s.companies.id, exceptId) : undefined,
      ),
    );
  return hit ?? null;
}

export async function addCompanyCore(
  actor: DbUser,
  input: { name: string; industry?: string; location?: string },
): Promise<{ id: string; name: string }> {
  assertMod(actor);
  const name = input.name.trim();
  if (!name) throw new WriteError("A company name is required");
  if (await findCompanyByNameOrAlias(name))
    throw new WriteError(`“${name}” already exists (name or alias)`);
  const slug = await uniqueSlug(name);
  const [created] = await db
    .insert(s.companies)
    .values({
      name,
      slug,
      industry: input.industry?.trim() || null,
      location: input.location?.trim() || null,
    })
    .returning({ id: s.companies.id, name: s.companies.name });
  return created;
}

export async function renameCompanyCore(
  actor: DbUser,
  id: string,
  input: { name: string; industry?: string; location?: string },
): Promise<void> {
  assertMod(actor);
  const name = input.name.trim();
  if (!name) throw new WriteError("A company name is required");
  const [target] = await db.select().from(s.companies).where(eq(s.companies.id, id));
  if (!target) throw new WriteError("Company not found");
  if (await findCompanyByNameOrAlias(name, id))
    throw new WriteError(`“${name}” collides with another company - merge instead`);
  // Slug stays stable (it's the URL); only the display name + facets change.
  await db
    .update(s.companies)
    .set({
      name,
      industry: input.industry?.trim() || null,
      location: input.location?.trim() || null,
    })
    .where(eq(s.companies.id, id));
}

export async function addCompanyAliasCore(
  actor: DbUser,
  id: string,
  alias: string,
): Promise<void> {
  assertMod(actor);
  const a = alias.trim();
  if (!a) throw new WriteError("An alias is required");
  const [target] = await db.select().from(s.companies).where(eq(s.companies.id, id));
  if (!target) throw new WriteError("Company not found");
  const taken = await findCompanyByNameOrAlias(a, id);
  if (taken) throw new WriteError(`“${a}” already belongs to ${taken.name}`);
  const known = new Set([target.name.toLowerCase(), ...target.aliases.map((x) => x.toLowerCase())]);
  if (known.has(a.toLowerCase())) return; // already an alias/name - no-op
  await db
    .update(s.companies)
    .set({ aliases: sql`array_append(${s.companies.aliases}, ${a})` })
    .where(eq(s.companies.id, id));
}

// Merge: fold `sourceId` into `targetId`. Repoint every experience, absorb the
// source's name + aliases into the target's aliases (so the spellings keep
// resolving), then delete the source row. One batch - the dedup is atomic.
export async function mergeCompaniesCore(
  actor: DbUser,
  sourceId: string,
  targetId: string,
): Promise<{ target: string; moved: number }> {
  assertMod(actor);
  if (sourceId === targetId) throw new WriteError("Pick two different companies");
  const [source] = await db.select().from(s.companies).where(eq(s.companies.id, sourceId));
  const [target] = await db.select().from(s.companies).where(eq(s.companies.id, targetId));
  if (!source || !target) throw new WriteError("Company not found");

  const [{ moved }] = await db
    .select({ moved: sql<number>`count(*)::int` })
    .from(s.experiences)
    .where(eq(s.experiences.companyId, sourceId));

  // New aliases for the target: its own + the source name + the source aliases,
  // minus anything already covered by the target's name/aliases.
  const have = new Set([target.name.toLowerCase(), ...target.aliases.map((a) => a.toLowerCase())]);
  const additions = [source.name, ...source.aliases].filter((a) => {
    const k = a.toLowerCase();
    if (have.has(k)) return false;
    have.add(k);
    return true;
  });
  const mergedAliases = [...target.aliases, ...additions];

  await db.batch([
    db.update(s.experiences).set({ companyId: targetId }).where(eq(s.experiences.companyId, sourceId)),
    db.update(s.companies).set({ aliases: mergedAliases }).where(eq(s.companies.id, targetId)),
    db.delete(s.companies).where(eq(s.companies.id, sourceId)),
  ]);
  return { target: target.name, moved };
}

// ── Round types ──────────────────────────────────────────────────────────────
export async function addRoundTypeCore(actor: DbUser, label: string): Promise<{ id: string }> {
  assertMod(actor);
  const l = label.trim();
  if (!l) throw new WriteError("A round name is required");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.roundTypes.id })
    .from(s.roundTypes)
    .where(sql`lower(${s.roundTypes.label}) = ${l.toLowerCase()} or ${s.roundTypes.slug} = ${slug}`);
  if (dupe) throw new WriteError(`“${l}” already exists`);
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${s.roundTypes.position}), -1)::int` })
    .from(s.roundTypes);
  const [created] = await db
    .insert(s.roundTypes)
    .values({ label: l, slug, position: maxPos + 1, createdBy: actor.id })
    .returning({ id: s.roundTypes.id });
  return created;
}

// Rename propagates to the denormalized rounds.name (all stored names are
// canonical labels, so they match by the old label) - keeps every experience
// consistent without a join.
export async function renameRoundTypeCore(
  actor: DbUser,
  id: string,
  label: string,
): Promise<void> {
  assertMod(actor);
  const l = label.trim();
  if (!l) throw new WriteError("A round name is required");
  const [target] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.id, id));
  if (!target) throw new WriteError("Round type not found");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.roundTypes.id })
    .from(s.roundTypes)
    .where(
      and(
        sql`lower(${s.roundTypes.label}) = ${l.toLowerCase()} or ${s.roundTypes.slug} = ${slug}`,
        ne(s.roundTypes.id, id),
      ),
    );
  if (dupe) throw new WriteError(`“${l}” already exists`);
  await db.batch([
    db.update(s.roundTypes).set({ label: l, slug }).where(eq(s.roundTypes.id, id)),
    db.update(s.rounds).set({ name: l }).where(eq(s.rounds.name, target.label)),
  ]);
}

export async function setRoundTypeActiveCore(
  actor: DbUser,
  id: string,
  isActive: boolean,
): Promise<void> {
  assertMod(actor);
  const [target] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.id, id));
  if (!target) throw new WriteError("Round type not found");
  await db.update(s.roundTypes).set({ isActive }).where(eq(s.roundTypes.id, id));
}

// Merge: fold `sourceId` into `targetId`. Rounds reference the type by its
// denormalized name, so repoint every round carrying the source label to the
// target's, then delete the source row. One batch - atomic dedup (mirrors
// mergeCompaniesCore; round types have no aliases to absorb).
export async function mergeRoundTypesCore(
  actor: DbUser,
  sourceId: string,
  targetId: string,
): Promise<{ target: string; moved: number }> {
  assertMod(actor);
  if (sourceId === targetId) throw new WriteError("Pick two different round types");
  const [source] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.id, sourceId));
  const [target] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.id, targetId));
  if (!source || !target) throw new WriteError("Round type not found");

  const [{ moved }] = await db
    .select({ moved: sql<number>`count(*)::int` })
    .from(s.rounds)
    .where(eq(s.rounds.name, source.label));

  await db.batch([
    db.update(s.rounds).set({ name: target.label }).where(eq(s.rounds.name, source.label)),
    db.delete(s.roundTypes).where(eq(s.roundTypes.id, sourceId)),
  ]);
  return { target: target.label, moved };
}

// ── Role types (concern #10, roles) ──────────────────────────────────────────
export async function addRoleTypeCore(actor: DbUser, label: string): Promise<{ id: string }> {
  assertMod(actor);
  const l = label.trim();
  if (!l) throw new WriteError("A role is required");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.roleTypes.id })
    .from(s.roleTypes)
    .where(sql`lower(${s.roleTypes.label}) = ${l.toLowerCase()} or ${s.roleTypes.slug} = ${slug}`);
  if (dupe) throw new WriteError(`“${l}” already exists`);
  const [created] = await db
    .insert(s.roleTypes)
    .values({ label: l, slug, createdBy: actor.id })
    .returning({ id: s.roleTypes.id });
  return created;
}

// Rename propagates to the denormalized experiences.role_title via the FK
// (role_type_id) — every post bound to this role follows the new label.
export async function renameRoleTypeCore(actor: DbUser, id: string, label: string): Promise<void> {
  assertMod(actor);
  const l = label.trim();
  if (!l) throw new WriteError("A role is required");
  const [target] = await db.select().from(s.roleTypes).where(eq(s.roleTypes.id, id));
  if (!target) throw new WriteError("Role type not found");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.roleTypes.id })
    .from(s.roleTypes)
    .where(
      and(
        sql`lower(${s.roleTypes.label}) = ${l.toLowerCase()} or ${s.roleTypes.slug} = ${slug}`,
        ne(s.roleTypes.id, id),
      ),
    );
  if (dupe) throw new WriteError(`“${l}” already exists`);
  await db.batch([
    db.update(s.roleTypes).set({ label: l, slug }).where(eq(s.roleTypes.id, id)),
    db.update(s.experiences).set({ roleTitle: l }).where(eq(s.experiences.roleTypeId, id)),
  ]);
}

export async function setRoleTypeActiveCore(
  actor: DbUser,
  id: string,
  isActive: boolean,
): Promise<void> {
  assertMod(actor);
  const [target] = await db.select().from(s.roleTypes).where(eq(s.roleTypes.id, id));
  if (!target) throw new WriteError("Role type not found");
  await db.update(s.roleTypes).set({ isActive }).where(eq(s.roleTypes.id, id));
}

// ── Topic tags ───────────────────────────────────────────────────────────────
type TagCategory = (typeof s.tagCategory.enumValues)[number];

export async function addTopicCore(
  actor: DbUser,
  input: { label: string; category: TagCategory },
): Promise<{ id: string }> {
  assertMod(actor);
  const l = input.label.trim();
  if (!l) throw new WriteError("A topic label is required");
  if (!(s.tagCategory.enumValues as readonly string[]).includes(input.category))
    throw new WriteError("Unknown category");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.topicTags.id })
    .from(s.topicTags)
    .where(sql`lower(${s.topicTags.label}) = ${l.toLowerCase()} or ${s.topicTags.slug} = ${slug}`);
  if (dupe) throw new WriteError(`“${l}” already exists`);
  const [created] = await db
    .insert(s.topicTags)
    .values({ label: l, slug, category: input.category, isDsa: input.category === "dsa", createdBy: actor.id })
    .returning({ id: s.topicTags.id });
  return created;
}

export async function renameTopicCore(actor: DbUser, id: string, label: string): Promise<void> {
  assertMod(actor);
  const l = label.trim();
  if (!l) throw new WriteError("A topic label is required");
  const [target] = await db.select().from(s.topicTags).where(eq(s.topicTags.id, id));
  if (!target) throw new WriteError("Topic not found");
  const slug = slugify(l);
  const [dupe] = await db
    .select({ id: s.topicTags.id })
    .from(s.topicTags)
    .where(
      and(
        sql`lower(${s.topicTags.label}) = ${l.toLowerCase()} or ${s.topicTags.slug} = ${slug}`,
        ne(s.topicTags.id, id),
      ),
    );
  if (dupe) throw new WriteError(`“${l}” already exists`);
  // Links reference tagId, so renaming the label needs no propagation.
  await db.update(s.topicTags).set({ label: l, slug }).where(eq(s.topicTags.id, id));
}

export async function setTopicActiveCore(
  actor: DbUser,
  id: string,
  isActive: boolean,
): Promise<void> {
  assertMod(actor);
  const [target] = await db.select().from(s.topicTags).where(eq(s.topicTags.id, id));
  if (!target) throw new WriteError("Topic not found");
  await db.update(s.topicTags).set({ isActive }).where(eq(s.topicTags.id, id));
}
