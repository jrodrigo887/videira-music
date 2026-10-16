import type { Actor } from "./actor";
import type { Capability } from "./capabilities";
import { holdsCapability } from "./capabilities";

export type Permission = Capability | "music:read" | "users:grantRole";

export function can(
  actor: Actor,
  permission: Permission,
  target: { organizationId: string; role?: string },
): boolean {
  if (actor.kind !== "user" || actor.organizationId !== target.organizationId) {
    return false;
  }

  switch (permission) {
    case "users:grantRole":
      if (!target.role) {
        return false;
      }
      if (target.role === "admin") {
        return holdsCapability(actor, "role.manage", target.organizationId);
      }
      return holdsCapability(actor, "user.manage", target.organizationId);
    case "music:read":
      return actor.roles.length > 0;
    case "users:invite:led":
      return (
        holdsCapability(actor, "users:invite:led", target.organizationId) ||
        holdsCapability(actor, "users:invite", target.organizationId)
      );
    default:
      return holdsCapability(actor, permission, target.organizationId);
  }
}
