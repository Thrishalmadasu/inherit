// Resend driver (PRD §12). Raw REST via fetch — two endpoints (single +
// batch send), so we skip the SDK dependency and its version churn entirely.
// Plain-text emails on purpose: short transactional notes, low spam score;
// a designed HTML template can land later without touching the seam.
//
// Requires RESEND_API_KEY, and the FROM_ADDRESS domain verified in Resend
// (SPF/DKIM DNS records — PRD §12) or every send 403s.
import {
  type DispatchResult,
  type EmailSender,
  FROM_ADDRESS,
  FROM_NAME,
  type InviteEmail,
  inviteText,
} from "./index";

const API = "https://api.resend.com";
const BATCH_SIZE = 100; // Resend's batch-endpoint max
const BACKOFF_MS = [1_000, 3_000]; // waits before attempt 2 and 3

const from = () => `${FROM_NAME} <${FROM_ADDRESS}>`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST with retry on 429 (2 req/s rate limit) and 5xx. Throws on final failure.
async function post(path: string, payload: unknown): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
    const body = await res.text();
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= BACKOFF_MS.length)
      throw new Error(`Resend ${res.status} on ${path}: ${body.slice(0, 300)}`);
    await sleep(BACKOFF_MS[attempt]);
  }
}

export const resendSender: EmailSender = {
  async sendStatus(e) {
    await post("/emails", {
      from: from(),
      to: [e.to],
      subject: e.subject,
      text: e.body,
    });
  },

  // Chunked through the batch endpoint (PRD §12: "bulk-send batched in
  // chunks within Resend's rate limits; failures retried server-side").
  // A chunk that still fails after retries marks all ITS recipients failed —
  // per-chunk granularity, recorded per row by the invites core.
  async sendInvites(emails: InviteEmail[]) {
    const results: DispatchResult[] = [];
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE);
      try {
        await post(
          "/emails/batch",
          chunk.map((e) => ({
            from: from(),
            to: [e.to],
            reply_to: [e.replyTo],
            subject: e.subject,
            text: inviteText(e),
          })),
        );
        results.push(...chunk.map((e) => ({ to: e.to, ok: true })));
      } catch (err) {
        results.push(
          ...chunk.map((e) => ({ to: e.to, ok: false, error: String(err) })),
        );
      }
    }
    return results;
  },
};
