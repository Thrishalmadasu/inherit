// The email seam (roadmap #5, PRD §12). Everything that sends mail goes
// through EmailSender; the driver is picked from env at call time:
// RESEND_API_KEY present → Resend, otherwise the console stub (logs every
// dispatch, sends nothing). EMAIL_DRIVER=console|resend forces one - the
// invariant test pins `console` so it can never email real students.
//
// This module must stay CLIENT-SAFE: the Ops invite compose preview imports
// the From constants. No db and no node: imports here or in the drivers.
// (./resend ↔ here is a deliberate import cycle - bindings are only touched
// inside function bodies, never at module init, so ESM resolves it cleanly.)
import { resendSender } from "./resend";

export const FROM_NAME = "Placement Ops · SST Inherit";

// Sender address. The subdomain is pending the Ops DNS decision (PRD §15 Q4),
// so it's a NEXT_PUBLIC_ env override: locking it needs no code change, and
// the client-side compose preview shows the address that will really be used.
// (NEXT_PUBLIC_ vars are inlined at build time - changing it needs a deploy.)
export const FROM_ADDRESS =
  process.env.NEXT_PUBLIC_EMAIL_FROM ?? "ops@inherit.sst.scaler.com";

export interface InviteEmail {
  to: string;
  subject: string; // merge tags already applied
  body: string; // merge tags already applied
  replyTo: string; // where replies land — the shared Ops sending address (FROM_ADDRESS)
  ctaUrl: string; // absolute pre-filled /share link
}

// Transactional review-status note to an author (PRD §7 Flow D).
export interface StatusEmail {
  to: string;
  subject: string;
  body: string;
}

export interface DispatchResult {
  to: string;
  ok: boolean;
  error?: string;
}

export interface EmailSender {
  // Review-status email. Throws on failure - call via dispatchStatus, which
  // logs and swallows (the notifications row is the durable record).
  sendStatus(email: StatusEmail): Promise<void>;
  // Outreach batch (Flow F). NEVER throws - returns per-recipient results so
  // the caller can stamp invite_recipients sent/failed row by row.
  sendInvites(emails: InviteEmail[]): Promise<DispatchResult[]>;
}

// Public origin for links inside emails. Vercel sets VERCEL_PROJECT_PRODUCTION_URL;
// locally fall back to the live site (links in stub logs should be clickable).
export function appOrigin(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "https://sst-inherit.vercel.app";
}

// Text rendering of an invite: the merge-applied body, then the CTA link
// (DEFAULT_BODY's "→ Share my … experience" line reads as its label).
export const inviteText = (e: InviteEmail) => `${e.body}\n\n${e.ctaUrl}\n`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// HTML rendering of an invite — mirrors the composer's live preview: body lines
// become paragraphs, and the "→ … experience" line becomes a real CTA button
// linking to the prefilled share URL (no naked URL dump). Sent alongside
// inviteText() as the plain-text fallback for clients that don't render HTML.
export function inviteHtml(e: InviteEmail): string {
  const body = e.body
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<div style=\"height:10px\"></div>";
      // A line that STARTS with an arrow (→, -> or =>) becomes the CTA button.
      const cta = line.match(/^\s*(?:→|->|=>)\s+(.*)$/);
      if (cta) {
        return `<a href="${escapeHtml(e.ctaUrl)}" style="display:inline-block;margin:6px 0 14px;padding:11px 20px;background:#2ea0f8;border-radius:8px;color:#ffffff;font-weight:600;font-size:14px;line-height:1;text-decoration:none;">${escapeHtml(cta[1])} &rarr;</a>`;
      }
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2b2f37;">${escapeHtml(line)}</p>`;
    })
    .join("");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2b2f37;">${body}</div>`;
}

const consoleSender: EmailSender = {
  async sendStatus(e) {
    console.log(`[email stub] status → ${e.to}\n  subject: ${e.subject}`);
  },
  async sendInvites(emails) {
    for (const e of emails)
      console.log(
        `[email stub] invite → ${e.to}\n  from: ${FROM_NAME} <${FROM_ADDRESS}> (reply-to ${e.replyTo})\n  subject: ${e.subject}\n  cta: ${e.ctaUrl}`,
      );
    return emails.map((e) => ({ to: e.to, ok: true }));
  },
};

// Test seam: db/verify-write-loop.ts swaps in a capturing sender to assert
// who got mailed on each transition. Never set outside tests.
let testOverride: EmailSender | null = null;
export function setEmailSenderForTest(sender: EmailSender | null): void {
  testOverride = sender;
}

export function getEmailSender(): EmailSender {
  if (testOverride) return testOverride;
  const driver =
    process.env.EMAIL_DRIVER ?? (process.env.RESEND_API_KEY ? "resend" : "console");
  return driver === "resend" ? resendSender : consoleSender;
}

// Status emails are best-effort: a mail-provider outage must never fail the
// moderation/submit action that already committed its rows.
export async function dispatchStatus(email: StatusEmail): Promise<void> {
  try {
    await getEmailSender().sendStatus(email);
  } catch (err) {
    console.error(`[email] status email to ${email.to} failed:`, err);
  }
}
