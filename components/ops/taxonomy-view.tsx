"use client";

// Ops canonical-entity management (concern #10): companies, round types, and
// topic tags - the lists students SELECT from. Three tabs; mutations call real
// Server Actions (moderator-gated) and refresh from the server. Data arrives as
// props (server-loaded); after every change we router.refresh() to re-read.
import { useState, useTransition } from "react";
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
  addRoundType,
  addTopic,
  mergeCompanies,
  renameCompany,
  renameRoundType,
  renameTopic,
  setRoundTypeActive,
  setTopicActive,
} from "@/app/actions/taxonomy";
import type { OpsCompanyRow, OpsRoundTypeRow, OpsTopicRow } from "@/lib/db/queries";
import type { ActionDataResult, ActionResult } from "@/lib/write/run";

const INPUT =
  "h-9 w-full rounded-md border border-border bg-bg-2 px-3 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]";
const TH = "px-[18px] py-3 text-left text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
const TD = "px-[18px] py-3 align-top";

const TAG_CATEGORIES = ["dsa", "system_design", "behavioral", "tooling", "domain", "other"] as const;
type Tab = "companies" | "rounds" | "topics";

export function TaxonomyView({
  canManage,
  companies,
  roundTypes,
  topics,
}: {
  canManage: boolean;
  companies: OpsCompanyRow[];
  roundTypes: OpsRoundTypeRow[];
  topics: OpsTopicRow[];
}) {
  const [tab, setTab] = useState<Tab>("companies");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
          Manage
        </span>
        <Chip label="Companies" count={companies.length} active={tab === "companies"} onClick={() => setTab("companies")} />
        <Chip label="Round types" count={roundTypes.length} active={tab === "rounds"} onClick={() => setTab("rounds")} />
        <Chip label="Topics" count={topics.length} active={tab === "topics"} onClick={() => setTab("topics")} />
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] leading-[1.55] text-fg-2">
          You can view the canonical lists here, but only <b className="text-fg">moderators</b> can
          add, rename, or merge entries.
        </div>
      )}

      {tab === "companies" && <CompaniesTab canManage={canManage} companies={companies} />}
      {tab === "rounds" && <RoundsTab canManage={canManage} roundTypes={roundTypes} />}
      {tab === "topics" && <TopicsTab canManage={canManage} topics={topics} />}

      <p className="mt-5 text-[12.5px] leading-[1.6] text-fg-3">
        Students pick companies, round types, and topics from these lists - they can never
        free-type a new one. A submission naming a company that isn&apos;t here yet rides in as a
        proposal and is resolved in the moderation queue. This is what keeps the data duplicate-free.
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

// ── Companies ────────────────────────────────────────────────────────────────
function CompaniesTab({ canManage, companies }: { canManage: boolean; companies: OpsCompanyRow[] }) {
  const { run, pending } = useRun();
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [edit, setEdit] = useState<OpsCompanyRow | null>(null);
  const [aliasFor, setAliasFor] = useState<OpsCompanyRow | null>(null);
  const [mergeFor, setMergeFor] = useState<OpsCompanyRow | null>(null);

  const f = filter.trim().toLowerCase();
  const shown = f
    ? companies.filter(
        (c) => c.name.toLowerCase().includes(f) || c.aliases.some((a) => a.toLowerCase().includes(f)),
      )
    : companies;

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
            disabled={pending || !name.trim()}
            onClick={() =>
              run(() => addCompany({ name: name.trim(), industry: industry.trim() || undefined }), `Added ${name.trim()}`, () => {
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
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter companies…"
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
            {shown.length === 0 && (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-[18px] py-8 text-center text-fg-3">
                  No companies match.
                </td>
              </tr>
            )}
            {shown.map((c) => (
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
        busy={pending}
        onClose={() => setEdit(null)}
        onConfirm={(v) => {
          const target = edit;
          if (!target) return;
          run(
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
        busy={pending}
        onClose={() => setAliasFor(null)}
        onConfirm={(v) => {
          const target = aliasFor;
          if (!target) return;
          run(() => addCompanyAlias(target.id, v.alias), `Alias added to ${target.name}`, () => setAliasFor(null));
        }}
      />

      {/* Merge */}
      <MergeModal
        source={mergeFor}
        companies={companies}
        busy={pending}
        onClose={() => setMergeFor(null)}
        onConfirm={(targetId) => {
          const src = mergeFor;
          if (!src) return;
          run(
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

function MergeModal({
  source,
  companies,
  busy,
  onConfirm,
  onClose,
}: {
  source: OpsCompanyRow | null;
  companies: OpsCompanyRow[];
  busy: boolean;
  onConfirm: (targetId: string) => void;
  onClose: () => void;
}) {
  const others = companies.filter((c) => c.id !== source?.id);
  const [target, setTarget] = useState("");
  const key = source?.id ?? "";
  const [seedKey, setSeedKey] = useState("");
  if (source && key !== seedKey) {
    setTarget("");
    setSeedKey(key);
  }

  return (
    <Modal
      open={!!source}
      onOpenChange={(o) => !o && onClose()}
      title={`Merge “${source?.name ?? ""}” into…`}
      description={`All ${source?.experiences ?? 0} posts move to the target; “${source?.name ?? ""}” and its aliases become aliases of the target, then it's deleted. This can't be undone.`}
    >
      <Select variant="sort" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
        <option value="">Select the company to keep…</option>
        {others.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.experiences})
          </option>
        ))}
      </Select>
      <div className="mt-3.5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={busy || !target}
          onClick={() => onConfirm(target)}
          className={cn("border-red-border bg-red-soft text-red hover:bg-[rgba(239,90,90,0.2)]", (busy || !target) && "cursor-not-allowed opacity-50")}
        >
          {busy ? "Merging…" : "Merge & delete source"}
        </Button>
      </div>
    </Modal>
  );
}
