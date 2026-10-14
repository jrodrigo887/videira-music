"use client";

import { useRouter } from "next/navigation";

import { ImportUnlockPanel } from "@/components/import/import-unlock-panel";

export function ImportPageUnlock() {
  const router = useRouter();
  return <ImportUnlockPanel onUnlocked={() => router.refresh()} />;
}
