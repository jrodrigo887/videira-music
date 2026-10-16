import type { Actor } from "./actor";

/** Blocks mutations while an admin is previewing as another user. */
export function viewAsMutationResponse(actor: Actor): Response | undefined {
  if (actor.kind !== "user" || !actor.viewAs) {
    return undefined;
  }
  return new Response(JSON.stringify({ error: { code: "VIEW_AS_READONLY" } }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
