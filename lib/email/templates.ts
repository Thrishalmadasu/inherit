// Review-status email content (PRD §7 Flow D): pure facts → {subject, body}.
// One template per author-facing review transition — the same four states the
// notifications table records. Hide/unhide deliberately have no email (PRD
// §12 lists exactly these four); the in-app notification row still lands.
import { appOrigin } from "./index";

export type StatusKind = "under_review" | "live" | "needs_edits" | "rejected";

export interface StatusFacts {
  authorName: string;
  company: string;
  role: string;
  expId: string;
  note?: string; // reviewer note (needs_edits) or reason (rejected)
}

const signOff = "— Placement Ops · Inherit";
const first = (name: string) => name.split(" ")[0] || "there";

export function statusEmailContent(
  kind: StatusKind,
  f: StatusFacts,
): { subject: string; body: string } {
  const origin = appOrigin();
  switch (kind) {
    case "under_review":
      return {
        subject: `Got it — your ${f.company} experience is in the review queue`,
        body: `Hi ${first(f.authorName)},

Thanks for sharing your ${f.company} (${f.role}) experience. It's in the review queue — every post is checked against the published rubric before it goes live, in submission order.

Track it here: ${origin}/under-review

${signOff}`,
      };
    case "live":
      return {
        subject: `Your ${f.company} experience is live`,
        body: `Hi ${first(f.authorName)},

Your ${f.company} (${f.role}) experience passed review and is now live for the whole batch:

${origin}/experiences/${f.expId}

Thanks for paying it forward.

${signOff}`,
      };
    case "needs_edits":
      return {
        subject: `Your ${f.company} post needs a quick edit`,
        body: `Hi ${first(f.authorName)},

A moderator reviewed your ${f.company} (${f.role}) post and asked for a small change before it goes live:

  "${f.note ?? ""}"

Edit and resubmit here (it rejoins the queue when you do): ${origin}/share?edit=${f.expId}

${signOff}`,
      };
    case "rejected":
      return {
        subject: `Your ${f.company} post wasn't approved`,
        body: `Hi ${first(f.authorName)},

Your ${f.company} (${f.role}) post didn't pass review:

  "${f.note ?? ""}"

You can find it under My Posts: ${origin}/me

${signOff}`,
      };
  }
}
