"use client";

// Ops canonical-entity management (concern #10): companies, round types, and
// topic tags - the lists students SELECT from. Three tabs; mutations call real
// Server Actions (moderator-gated) and refresh from the server. Data arrives as
// props (server-loaded); after every change we router.refresh() to re-read.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  addCompany,
  addCompanyAlias,
  addRoleType,
  addRoundType,
  addTopic,
  fetchOpsCompanies,
  mergeCompanies,
  renameCompany,
  renameRoleType,
  renameRoundType,
  renameTopic,
  setRoleTypeActive,
  setRoundTypeActive,
  setTopicActive,
} from "@/app/actions/taxonomy";
import { searchCompaniesForResolve } from "@/app/actions/ops";
import type {
  OpsCompanyRow,
  OpsRoleTypeRow,
  OpsRoundTypeRow,
  OpsTopicRow,
  Paginated,
} from "@/lib/db/queries";
import type { ActionDataResult, ActionResult } from "@/lib/write/run";

const INPUT =
  "h-9 w-full rounded-md border border-border bg-bg-2 px-3 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]";
const TH = "px-[18px] py-3 text-left text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
const TD = "px-[18px] py-3 align-top";

const TAG_CATEGORIES = ["dsa", "system_design", "behavioral", "tooling", "domain", "other"] as const;
type Tab = "companies" | "rounds" | "roles" | "topics";

export function TaxonomyView({
  canManage,
  companies,
  roundTypes,
  roleTypes,
  topics,
}: {
  canManage: boolean;
  companies: Paginated<OpsCompanyRow>; // paginated (can grow); seed = page 1
  roundTypes: OpsRoundTypeRow[];
  roleTypes: OpsRoleTypeRow[];
  topics: OpsTopicRow[];
}) {
  const [tab, setTab] = useState<Tab>("companies");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
          Manage
        </span>
        <Chip label="Companies" count={companies.total} active={tab === "companies"} onClick={() => setTab("companies")} />
        <Chip label="Round types" count={roundTypes.length} active={tab === "rounds"} onClick={() => setTab("rounds")} />
        <Chip label="Roles" count={roleTypes.length} active={tab === "roles"} onClick={() => setTab("roles")} />
        <Chip label="Topics" count={topics.length} active={tab === "topics"} onClick={() => setTab("topics")} />
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] leading-[1.55] text-fg-2">
          You can view the canonical lists here, but only <b className="text-fg">moderators</b> can
          add, rename, or merge entries.
        </div>
      )}

      {tab === "companies" && <CompaniesTab canManage={canManage} initial={companies} />}
      {tab === "rounds" && <RoundsTab canManage={canManage} roundTypes={roundTypes} />}
      {tab === "roles" && <RolesTab canManage={canManage} roleTypes={roleTypes} />}
      {tab === "topics" && <TopicsTab canManage={canManage} topics={topics} />}

      <p className="mt-5 text-[12.5px] leading-[1.6] text-fg-3">
        Students pick companies, round types, roles, and topics from these lists. A submission
        naming a company or role that isn&apos;t here yet rides in as a proposal and is resolved in
        the moderation queue. This is what keeps the data duplicate-free.
      </p>
    </>
  );
}

// Shared: run an action, toast, refresh.
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<ActionResult | ActionDataResult<unknown>>,
    okMsg: string,
    after?: () => void,
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(okMsg);
      after?.();
      router.refresh();
    });
  return { run, pending };
}

// ── Companies (server-paginated + search) ────────────────────────────────────
function CompaniesTab({ canManage, initial }: { canManage: boolean; initial: Paginated<OpsCompanyRow> }) {
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pending, startT] = useTransition();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [edit, setEdit] = useState<OpsCompanyRow | null>(null);
  const [aliasFor, setAliasFor] = useState<OpsCompanyRow | null>(null);
  const [mergeFor, setMergeFor] = useState<OpsCompanyRow | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (p: number, query: string) => {
    setLoading(true);
    try {
      const res = await fetchOpsCompanies({ q: query.trim() || undefined, page: p });
      setData(res);
      setPage(p);
    } catch {
      toast("Couldn't load companies - please try again");
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (next: string) => {
    setQ(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(1, next), 300);
  };

  // Run a mutation, then re-fetch the current page so the table reflects it.
  const mutate = (
    fn: () => Promise<ActionResult | ActionDataResult<unknown>>,
    okMsg: string,
    after?: () => void,
  ) =>
    startT(async () => {
      const res = await fn();
      if (!res.ok) {
        toast(res.error);
        return;
      }
      toast(okMsg);
      after?.();
      await load(page, q);
    });

  const busy = pending || loading;
  const from = data.total === 0 ? 0 : (page - 1) * 10 + 1;
  const to = (page - 1) * 10 + data.items.length;

  return (
    <>
      {canManage && (
        <div className="mb-3.5 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-4 py-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-3">New company</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className={INPUT} />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-3">Industry (optional)</span>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech" className={INPUT} />
          </label>
          <Button
            variant="primary"
            disabled={busy || !name.trim()}
            onClick={() =>
              mutate(() => addCompany({ name: name.trim(), industry: industry.trim() || undefined }), `Added ${name.trim()}`, () => {
                setName("");
                setIndustry("");
              })
            }
          >
            <Icon.plus /> Add
          </Button>
        </div>
      )}

      <input
        value={q}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search companies by name or alias…"
        className={cn(INPUT, "mb-3 max-w-[340px]")}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Company</th>
              <th className={TH}>Aliases</th>
              <th className={TH}>Posts</th>
              {canManage && <th className={cn(TH, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-[18px] py-8 text-center text-fg-3">
                  No companies match.
                </td>
              </tr>
            )}
            {data.items.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className={TD}>
                  <div className="font-semibold tracking-[-0.005em]">{c.name}</div>
                  <div className="mt-px text-[11.5px] text-fg-3">
                    {c.slug}
                    {c.industry && ` · ${c.industry}`}
                  </div>
                </td>
                <td className={cn(TD, "text-fg-2")}>
                  {c.aliases.length ? (
                    <div className="flex flex-wrap gap-1">
                      {c.aliases.map((a) => (
                        <span key={a} className="rounded-full border border-border bg-bg-2 px-2 py-0.5 text-[11px]">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-fg-4">-</span>
                  )}
                </td>
                <td className={cn(TD, "tabular-nums text-fg-2")}>{c.experiences}</td>
                {canManage && (
                  <td className={cn(TD, "text-right")}>
                    <div className="inline-flex gap-1.5">
                      <RowBtn onClick={() => setEdit(c)}>Rename</RowBtn>
                      <RowBtn onClick={() => setAliasFor(c)}>+ Alias</RowBtn>
                      <RowBtn onClick={() => setMergeFor(c)}>Merge</RowBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-[12.5px] text-fg-3">
        <span>{data.total === 0 ? "No companies" : `Showing ${from}–${to} of ${data.total}`}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || busy}
            onClick={() => load(page - 1, q)}
            className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="tabular-nums">Page {page}</span>
          <button
            type="button"
            disabled={!data.hasMore || busy}
            onClick={() => load(page + 1, q)}
            className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Rename company */}
      <FormModal
        open={!!edit}
        title={`Rename “${edit?.name ?? ""}”`}
        description="The display name and facets change; the URL slug stays stable so links keep working."
        fields={[
          { key: "name", label: "Name", value: edit?.name ?? "", required: true },
          { key: "industry", label: "Industry", value: edit?.industry ?? "" },
          { key: "location", label: "Location", value: edit?.location ?? "" },
        ]}
        confirmLabel="Save"
        busy={busy}
        onClose={() => setEdit(null)}
        onConfirm={(v) => {
          const target = edit;
          if (!target) return;
          mutate(
            () => renameCompany(target.id, { name: v.name, industry: v.industry, location: v.location }),
            "Company updated",
            () => setEdit(null),
          );
        }}
      />

      {/* Add alias */}
      <FormModal
        open={!!aliasFor}
        title={`Add an alias for “${aliasFor?.name ?? ""}”`}
        description="Future submissions typing this spelling will auto-bind to this company (dedup at the root)."
        fields={[{ key: "alias", label: "Alias", value: "", required: true }]}
        confirmLabel="Add alias"
        busy={busy}
        onClose={() => setAliasFor(null)}
        onConfirm={(v) => {
          const target = aliasFor;
          if (!target) return;
          mutate(() => addCompanyAlias(target.id, v.alias), `Alias added to ${target.name}`, () => setAliasFor(null));
        }}
      />

      {/* Merge (target chosen via search — the full list isn't loaded client-side) */}
      <MergeModal
        source={mergeFor}
        busy={busy}
        onClose={() => setMergeFor(null)}
        onConfirm={(targetId) => {
          const src = mergeFor;
          if (!src) return;
          mutate(
            async () => {
              const res = await mergeCompanies(src.id, targetId);
              if (res.ok) toast(`Merged into ${res.data.target} (${res.data.moved} posts moved)`);
              return res;
            },
            "Companies merged",
            () => setMergeFor(null),
          );
        }}
      />
    </>
  );
}

// ── Round types ──────────────────────────────────────────────────────────────
function RoundsTab({ canManage, roundTypes }: { canManage: boolean; roundTypes: OpsRoundTypeRow[] }) {
  const { run, pending } = useRun();
  const [label, setLabel] = useState("");
  const [edit, setEdit] = useState<OpsRoundTypeRow | null>(null);

  return (
    <>
      {canManage && (
        <AddOne
          placeholder="New round type - e.g. Take-home"
          value={label}
          onChange={setLabel}
          disabled={pending}
          onAdd={() => run(() => addRoundType(label.trim()), `Added ${label.trim()}`, () => setLabel(""))}
        />
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Round type</th>
              <th className={TH}>Used by</th>
              <th className={TH}>Status</th>
              {canManage && <th className={cn(TH, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {roundTypes.map((r) => (
              <tr key={r.id} className={cn("border-b border-border last:border-b-0", !r.isActive && "opacity-55")}>
                <td className={TD}>
                  <span className="font-semibold">{r.label}</span>
                  <span className="ml-2 text-[11.5px] text-fg-3">{r.slug}</span>
                </td>
                <td className={cn(TD, "tabular-nums text-fg-2")}>{r.uses} rounds</td>
                <td className={TD}>
                  <ActiveBadge active={r.isActive} />
                </td>
                {canManage && (
                  <td className={cn(TD, "text-right")}>
                    <div className="inline-flex gap-1.5">
                      <RowBtn onClick={() => setEdit(r)}>Rename</RowBtn>
                      <RowBtn onClick={() => run(() => setRoundTypeActive(r.id, !r.isActive), r.isActive ? "Deactivated" : "Reactivated")}>
                        {r.isActive ? "Deactivate" : "Reactivate"}
                      </RowBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal
        open={!!edit}
        title={`Rename “${edit?.label ?? ""}”`}
        description="Renaming propagates to every experience already using this round (kept in sync)."
        fields={[{ key: "label", label: "Round name", value: edit?.label ?? "", required: true }]}
        confirmLabel="Save"
        busy={pending}
        onClose={() => setEdit(null)}
        onConfirm={(v) => {
          const target = edit;
          if (!target) return;
          run(() => renameRoundType(target.id, v.label), "Round type renamed", () => setEdit(null));
        }}
      />
    </>
  );
}

// ── Role types ───────────────────────────────────────────────────────────────
function RolesTab({ canManage, roleTypes }: { canManage: boolean; roleTypes: OpsRoleTypeRow[] }) {
  const { run, pending } = useRun();
  const [label, setLabel] = useState("");
  const [edit, setEdit] = useState<OpsRoleTypeRow | null>(null);

  return (
    <>
      {canManage && (
        <AddOne
          placeholder="New role - e.g. SRE Intern"
          value={label}
          onChange={setLabel}
          disabled={pending}
          onAdd={() => run(() => addRoleType(label.trim()), `Added ${label.trim()}`, () => setLabel(""))}
        />
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Role</th>
              <th className={TH}>Used by</th>
              <th className={TH}>Status</th>
              {canManage && <th className={cn(TH, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {roleTypes.map((r) => (
              <tr key={r.id} className={cn("border-b border-border last:border-b-0", !r.isActive && "opacity-55")}>
                <td className={TD}>
                  <span className="font-semibold">{r.label}</span>
                  <span className="ml-2 text-[11.5px] text-fg-3">{r.slug}</span>
                </td>
                <td className={cn(TD, "tabular-nums text-fg-2")}>{r.uses} posts</td>
                <td className={TD}>
                  <ActiveBadge active={r.isActive} />
                </td>
                {canManage && (
                  <td className={cn(TD, "text-right")}>
                    <div className="inline-flex gap-1.5">
                      <RowBtn onClick={() => setEdit(r)}>Rename</RowBtn>
                      <RowBtn onClick={() => run(() => setRoleTypeActive(r.id, !r.isActive), r.isActive ? "Deactivated" : "Reactivated")}>
                        {r.isActive ? "Deactivate" : "Reactivate"}
                      </RowBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal
        open={!!edit}
        title={`Rename “${edit?.label ?? ""}”`}
        description="Renaming propagates to every experience already using this role (kept in sync)."
        fields={[{ key: "label", label: "Role", value: edit?.label ?? "", required: true }]}
        confirmLabel="Save"
        busy={pending}
        onClose={() => setEdit(null)}
        onConfirm={(v) => {
          const target = edit;
          if (!target) return;
          run(() => renameRoleType(target.id, v.label), "Role renamed", () => setEdit(null));
        }}
      />
    </>
  );
}

// ── Topics ───────────────────────────────────────────────────────────────────
function TopicsTab({ canManage, topics }: { canManage: boolean; topics: OpsTopicRow[] }) {
  const { run, pending } = useRun();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<(typeof TAG_CATEGORIES)[number]>("dsa");
  const [edit, setEdit] = useState<OpsTopicRow | null>(null);

  return (
    <>
      {canManage && (
        <div className="mb-3.5 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-4 py-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-3">New topic</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Topic label - e.g. Tries" className={INPUT} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-3">Category</span>
            <Select variant="sort" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {TAG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            disabled={pending || !label.trim()}
            onClick={() => run(() => addTopic({ label: label.trim(), category }), `Added ${label.trim()}`, () => setLabel(""))}
          >
            <Icon.plus /> Add
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Topic</th>
              <th className={TH}>Category</th>
              <th className={TH}>Used by</th>
              <th className={TH}>Status</th>
              {canManage && <th className={cn(TH, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id} className={cn("border-b border-border last:border-b-0", !t.isActive && "opacity-55")}>
                <td className={TD}>
                  <span className="font-semibold">{t.label}</span>
                  {t.isDsa && <span className="ml-2 rounded-full border border-blue-border bg-blue-soft px-1.5 py-px text-[10px] font-semibold text-blue">DSA</span>}
                </td>
                <td className={cn(TD, "text-fg-2")}>{t.category.replace("_", " ")}</td>
                <td className={cn(TD, "tabular-nums text-fg-2")}>{t.uses} blocks</td>
                <td className={TD}>
                  <ActiveBadge active={t.isActive} />
                </td>
                {canManage && (
                  <td className={cn(TD, "text-right")}>
                    <div className="inline-flex gap-1.5">
                      <RowBtn onClick={() => setEdit(t)}>Rename</RowBtn>
                      <RowBtn onClick={() => run(() => setTopicActive(t.id, !t.isActive), t.isActive ? "Deactivated" : "Reactivated")}>
                        {t.isActive ? "Deactivate" : "Reactivate"}
                      </RowBtn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal
        open={!!edit}
        title={`Rename “${edit?.label ?? ""}”`}
        description="Existing tagged blocks follow the rename automatically (they reference the tag, not the text)."
        fields={[{ key: "label", label: "Topic label", value: edit?.label ?? "", required: true }]}
        confirmLabel="Save"
        busy={pending}
        onClose={() => setEdit(null)}
        onConfirm={(v) => {
          const target = edit;
          if (!target) return;
          run(() => renameTopic(target.id, v.label), "Topic renamed", () => setEdit(null));
        }}
      />
    </>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function RowBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[28px] rounded-md border border-border px-2.5 text-[12px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em]",
        active ? "border-green-border bg-green-soft text-green" : "border-border bg-surface-3 text-fg-3",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AddOne({
  placeholder,
  value,
  onChange,
  onAdd,
  disabled,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAdd();
      }}
      className="mb-3.5 flex gap-2"
    >
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(INPUT, "max-w-[420px]")} />
      <Button variant="primary" disabled={disabled || !value.trim()} onClick={onAdd}>
        <Icon.plus /> Add
      </Button>
    </form>
  );
}

type Field = { key: string; label: string; value: string; required?: boolean };

// Generic small form modal (rename / alias). Seeds inputs from `fields` each
// time it opens (keyed on the joined values).
function FormModal({
  open,
  title,
  description,
  fields,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  fields: Field[];
  confirmLabel: string;
  busy: boolean;
  onConfirm: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const seed = Object.fromEntries(fields.map((f) => [f.key, f.value]));
  const [values, setValues] = useState<Record<string, string>>(seed);
  const [seedKey, setSeedKey] = useState("");
  const key = fields.map((f) => `${f.key}=${f.value}`).join("|");
  if (open && key !== seedKey) {
    setValues(seed);
    setSeedKey(key);
  }
  const missingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title} description={description}>
      <div className="flex flex-col gap-2.5">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-fg-3">
              {f.label}
              {f.required && " *"}
            </span>
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={INPUT}
              autoFocus={fields[0].key === f.key}
            />
          </label>
        ))}
      </div>
      <div className="mt-3.5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={busy || missingRequired}
          onClick={() =>
            onConfirm(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])))
          }
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// The target company is chosen via a server search (the full list isn't loaded
// client-side now that companies are paginated).
function MergeModal({
  source,
  busy,
  onConfirm,
  onClose,
}: {
  source: OpsCompanyRow | null;
  busy: boolean;
  onConfirm: (targetId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; industry: string }[]>([]);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const key = source?.id ?? "";
  const [seedKey, setSeedKey] = useState("");
  if (source && key !== seedKey) {
    setSeedKey(key);
    setQ("");
    setResults([]);
    setTarget(null);
  }

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await searchCompaniesForResolve(term);
        setResults(res.filter((c) => c.id !== source?.id));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, source?.id]);

  return (
    <Modal
      open={!!source}
      onOpenChange={(o) => !o && onClose()}
      title={`Merge “${source?.name ?? ""}” into…`}
      description={`All ${source?.experiences ?? 0} posts move to the target; “${source?.name ?? ""}” and its aliases become aliases of the target, then it's deleted. This can't be undone.`}
    >
      {target ? (
        <div className="flex items-center justify-between rounded-md border border-blue-border bg-blue-soft px-3 py-2 text-[13px]">
          <span>
            Keep <b className="font-semibold">{target.name}</b>
          </span>
          <button type="button" onClick={() => setTarget(null)} className="text-[12px] text-fg-3 hover:text-fg">
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the company to keep…"
            className={INPUT}
          />
          {results.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTarget({ id: c.id, name: c.name })}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-left text-[13px] hover:border-blue-border"
                >
                  <b className="font-semibold">{c.name}</b>
                  {c.industry && <span className="text-[11.5px] text-fg-3">{c.industry}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-3.5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={busy || !target}
          onClick={() => target && onConfirm(target.id)}
          className={cn("border-red-border bg-red-soft text-red hover:bg-[rgba(239,90,90,0.2)]", (busy || !target) && "cursor-not-allowed opacity-50")}
        >
          {busy ? "Merging…" : "Merge & delete source"}
        </Button>
      </div>
    </Modal>
  );
}
