"use client";

// Edit / Withdraw controls on the Under Review banner. Withdraw pulls the
// post out of the queue (restorable from My Posts); edit re-opens the form.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { withdrawMyPost } from "@/app/actions/my-posts";

export function PendingActions({ expId }: { expId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    if (!confirm("Withdraw this post from the review queue? You can resubmit it any time from My Posts."))
      return;
    setBusy(true);
    const result = await withdrawMyPost(expId);
    setBusy(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    toast("Withdrawn — find it on My Posts whenever you're ready");
    router.push("/me");
  };

  return (
    <div className="flex shrink-0 gap-2">
      <Button href={`/share?edit=${expId}`}>
        <Icon.pencil /> Edit submission
      </Button>
      <Button onClick={withdraw} disabled={busy}>
        {busy ? "Withdrawing…" : "Withdraw"}
      </Button>
    </div>
  );
}
