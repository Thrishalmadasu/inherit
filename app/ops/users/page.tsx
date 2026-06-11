"use client";

import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

// Super Admin user management. Tonight: mock list, role changes toast-only.
// Real promote/demote + RoleChangeAudit land with the database.
const USERS = [
  { name: "Thrishal M.", email: "thrishal.23bcs10115@sst.scaler.com", batch: "'27", role: "super_admin" },
  { name: "Riya K.", email: "riya.23bcs10043@sst.scaler.com", batch: "'27", role: "moderator" },
  { name: "Aarav S.", email: "aarav.23bcs10084@sst.scaler.com", batch: "'27", role: "student" },
  { name: "Nikhil D.", email: "nikhil.23bcs10071@sst.scaler.com", batch: "'27", role: "student" },
  { name: "Priya R.", email: "priya.23bcs10112@sst.scaler.com", batch: "'27", role: "student" },
] as const;

const ROLE_PILL: Record<string, string> = {
  super_admin: "border-[rgba(122,90,224,0.35)] bg-[rgba(122,90,224,0.13)] text-[#b196f8]",
  moderator: "border-blue-border bg-blue-soft text-blue",
  student: "border-gray-border bg-gray-soft text-fg-2",
};

const AUDIT = [
  { who: "Riya K.", change: "Student → Moderator", by: "Thrishal M.", when: "May 02, 2026" },
  { who: "Thrishal M.", change: "Seeded as Super Admin", by: "deploy", when: "Apr 30, 2026" },
];

export default function OpsUsersPage() {
  return (
    <>
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
            {USERS.map((u) => (
              <tr key={u.email} className="border-b border-border last:border-b-0">
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
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-[18px] py-3 text-right">
                  <Select
                    variant="sort"
                    defaultValue={u.role}
                    onChange={() =>
                      toast("Role changes are audited and arrive with the database")
                    }
                  >
                    <option value="student">Student</option>
                    <option value="moderator">Moderator</option>
                    <option value="super_admin">Super Admin</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
          Recent role changes
        </h3>
        <div className="flex flex-col gap-2">
          {AUDIT.map((a, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-[13px]"
            >
              <b className="font-semibold">{a.who}</b>
              <span className="text-fg-2">{a.change}</span>
              <span className="ml-auto text-xs text-fg-3">
                by {a.by} · {a.when}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.55] text-fg-3">
          Only Super Admins can change roles. Every change is written to the
          audit trail — who changed whom, when, and the prior role.
        </p>
      </div>
    </>
  );
}
