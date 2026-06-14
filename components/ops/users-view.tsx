"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole } from "@/app/actions/roles";
import type { OpsUsersPage, RoleChangeEntry } from "@/lib/db/queries";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

const ROLE_PILL: Record<string, string> = {
  super_admin: "border-[rgba(122,90,224,0.35)] bg-[rgba(122,90,224,0.13)] text-[#b196f8]",
  moderator: "border-blue-border bg-blue-soft text-blue",
  student: "border-gray-border bg-gray-soft text-fg-2",
};
const prettyRole = (r: string) => r.replace("_", " ");

export function UsersView({
  canManage,
  q,
  data,
  audit,
}: {
  canManage: boolean;
  q: string;
  data: OpsUsersPage;
  audit: RoleChangeEntry[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);

  const navigate = (next: { q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const query = next.q ?? q;
    if (query.trim()) params.set("q", query.trim());
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.push(`/ops/users${params.toString() ? `?${params}` : ""}`);
  };

  const { page, totalPages, total, pageSize } = data;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: term, page: 1 });
        }}
        className="mb-3.5 flex gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name or email…"
          className="h-[34px] w-full max-w-[340px] rounded-md border border-border bg-bg-2 px-3 text-[13px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              navigate({ q: "", page: 1 });
            }}
            className="h-[34px] rounded-md border border-border px-3 text-[13px] font-medium text-fg-2 hover:bg-surface-3"
          >
            Clear
          </button>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[11.5px] uppercase tracking-[0.06em] text-fg-3">
              <th className="px-[18px] py-3 font-medium">User</th>
              <th className="px-[18px] py-3 font-medium">Batch</th>
              <th className="px-[18px] py-3 font-medium">Role</th>
              <th className="px-[18px] py-3 text-right font-medium">Change role</th>
            </tr>
          </thead>
          <tbody>
            {data.users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-[18px] py-8 text-center text-fg-3">
                  No users match “{q}”.
                </td>
              </tr>
            )}
            {data.users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-b-0">
                <td className="px-[18px] py-3">
                  <div className="font-semibold tracking-[-0.005em]">{u.name}</div>
                  <div className="mt-px text-[11.5px] text-fg-3">{u.email}</div>
                </td>
                <td className="px-[18px] py-3 text-fg-2">{u.batch}</td>
                <td className="px-[18px] py-3">
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em]",
                      ROLE_PILL[u.role],
                    )}
                  >
                    {prettyRole(u.role)}
                  </span>
                </td>
                <td className="px-[18px] py-3 text-right">
                  <RoleSelect
                    key={`${u.id}:${u.role}`}
                    userId={u.id}
                    defaultRole={u.role}
                    disabled={!canManage}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-[12.5px] text-fg-3">
        <span>
          {total === 0 ? "No users" : `Showing ${first}–${last} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
            className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => navigate({ page: page + 1 })}
            className="h-[30px] rounded-md border border-border px-3 font-medium text-fg-2 enabled:hover:bg-surface-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
          Recent role changes
        </h3>
        {audit.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">No role changes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {audit.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-[13px]"
              >
                <b className="font-semibold">{a.who}</b>
                <span className="text-fg-2">
                  {prettyRole(a.fromRole)} → {prettyRole(a.toRole)}
                </span>
                {a.reason && <span className="text-fg-3">· {a.reason}</span>}
                <span className="ml-auto text-xs text-fg-3">
                  by {a.by} · {a.when}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12.5px] leading-[1.55] text-fg-3">
          Only super admins can change roles. Every change is written to the audit
          trail - who changed whom, when, and the prior role.
        </p>
      </div>
    </>
  );
}

// Controlled so it can optimistically reflect the pick and revert on error.
// Parent keys it by `${id}:${role}` so a committed change (after router.refresh)
// remounts it seeded with the new server role.
function RoleSelect({
  userId,
  defaultRole,
  disabled,
}: {
  userId: string;
  defaultRole: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultRole);
  const [pending, start] = useTransition();

  return (
    <Select
      variant="sort"
      value={value}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value;
        const prev = value;
        setValue(next);
        start(async () => {
          const res = await changeUserRole(userId, next);
          if (!res.ok) {
            toast(res.error);
            setValue(prev);
            return;
          }
          toast(`${res.data.name}: ${prettyRole(res.data.fromRole)} → ${prettyRole(res.data.toRole)}`);
          router.refresh();
        });
      }}
    >
      <option value="student">Student</option>
      <option value="moderator">Moderator</option>
      <option value="super_admin">Super Admin</option>
    </Select>
  );
}
