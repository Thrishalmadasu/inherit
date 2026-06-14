import { InviteView } from "@/components/ops/invite-view";

// Invite-to-share (PRD §7 Flow F) - CSV upload → validate emails → compose
// with merge tags → batch send. Send-only V1, NO dedupe (every valid row
// sends; Ops invites per experience). emailLive tells the banner whether real
// emails go out or the console stub logs them (lib/email driver selection).
export default function OpsInvitePage() {
  return <InviteView emailLive={Boolean(process.env.RESEND_API_KEY)} />;
}
