import { getInviteDedupe } from "@/lib/db/queries";
import { InviteView } from "@/components/ops/invite-view";

// Invite-to-share (PRD §7 Flow F) — CSV upload → dedupe buckets → compose
// with merge tags → batch send. Send-only V1. The dedupe sets load here so
// the client can bucket as it parses; the Send action re-derives them.
export default async function OpsInvitePage() {
  const { alreadyShared, alreadyInvited } = await getInviteDedupe();
  return (
    <InviteView
      alreadyShared={alreadyShared}
      alreadyInvited={alreadyInvited}
      // Whether real emails go out, or the console stub logs them (lib/email
      // driver selection) — the success banner tells Ops the truth either way.
      emailLive={Boolean(process.env.RESEND_API_KEY)}
    />
  );
}
