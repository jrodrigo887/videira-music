import "server-only";

import { redirect } from "next/navigation";

import type { UserActor } from "./actor";
import { getCurrentActor } from "./current-actor";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export async function requirePageActor(nextPath?: string): Promise<UserActor> {
  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/entrar${next}`);
  }
  return actor;
}
