import { Icon } from "@/components/icons";

// Placeholder — the full Invite-to-share flow (CSV upload → dedupe → compose
// with merge tags → batch send) ships with the outreach work after the
// database + email integration land.
export default function OpsInvitePage() {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-16 text-center text-fg-3">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-blue-border bg-blue-soft text-blue">
        <Icon.upload className="size-5" />
      </div>
      <strong className="mb-1.5 block text-[15px] font-semibold text-fg">
        Invite to share is coming with the daily-batch outreach
      </strong>
      <p className="mx-auto m-0 max-w-[480px] text-[13.5px] leading-[1.6]">
        Upload the day&apos;s completed-interview CSV, compose with merge tags
        ({"{{name}}"}, {"{{company}}"}, {"{{role}}"}, {"{{round}}"}), preview, and
        batch-send personalised invites from ops@inherit. Recipients land on a
        pre-filled share form.
      </p>
    </div>
  );
}
