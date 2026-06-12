// The email seam (roadmap #5). Everything that sends mail goes through
// EmailSender so the Resend integration is a one-file swap — until then the
// console stub makes every dispatch visible in server logs without sending
// anything. Server-only (called from write cores).

export const FROM_NAME = "Placement Ops · Inherit";
export const FROM_ADDRESS = "ops@inherit.sst.scaler.com";

export interface InviteEmail {
  to: string;
  subject: string; // merge tags already applied
  body: string; // merge tags already applied
  replyTo: string; // the sending Ops member's SST email
  ctaUrl: string; // absolute pre-filled /share link
}

export interface EmailSender {
  sendInvite(email: InviteEmail): Promise<void>;
}

// Public origin for links inside emails. Vercel sets VERCEL_PROJECT_PRODUCTION_URL;
// locally fall back to the live site (links in stub logs should be clickable).
export function appOrigin(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "https://inherit-three.vercel.app";
}

const consoleSender: EmailSender = {
  async sendInvite(e) {
    console.log(
      `[email stub] invite → ${e.to}\n  from: ${FROM_NAME} <${FROM_ADDRESS}> (reply-to ${e.replyTo})\n  subject: ${e.subject}\n  cta: ${e.ctaUrl}`,
    );
  },
};

export function getEmailSender(): EmailSender {
  return consoleSender;
}
