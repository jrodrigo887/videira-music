import "server-only";

import type { Permission } from "./permissions";
import { can } from "./permissions";
import type { UserActor } from "./actor";
import { getCurrentActor } from "./current-actor";

export function unauthenticatedResponse(): Response {
  return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
}

export function forbiddenResponse(): Response {
  return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
}

export async function requireActor(): Promise<{ actor: UserActor } | { response: Response }> {
  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    return { response: unauthenticatedResponse() };
  }
  return { actor };
}

export async function requirePermission(
  permission: Permission,
  organizationId: string,
  options?: { role?: Parameters<typeof can>[2]["role"] },
): Promise<{ actor: UserActor } | { response: Response }> {
  const gate = await requireActor();
  if ("response" in gate) {
    return gate;
  }
  if (!can(gate.actor, permission, { organizationId, role: options?.role })) {
    return { response: forbiddenResponse() };
  }
  return gate;
}
