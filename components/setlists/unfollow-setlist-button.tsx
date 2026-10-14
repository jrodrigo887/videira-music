"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UnfollowSetlistButtonProps = {
  setlistId: string;
  teamId: string;
};

export function UnfollowSetlistButton({ setlistId, teamId }: UnfollowSetlistButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unfollow() {
    setBusy(true);
    try {
      await fetch(`/api/setlists/${encodeURIComponent(setlistId)}/follow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="ds-button-secondary shrink-0" disabled={busy} onClick={unfollow}>
      Deixar de seguir
    </button>
  );
}
