import type { Actor } from "./actor";
import { hasCapability, hasRole } from "./actor";

export type Permission =
  | "users:invite"
  | "users:manage"
  | "users:grantRole"
  | "teams:manage"
  | "music:read"
  | "music:write"
  | "import";

export function can(
  actor: Actor,
  permission: Permission,
  target: { organizationId: string; role?: string },
): boolean {
  if (actor.kind !== "user" || actor.organizationId !== target.organizationId) {
    return false;
  }

  switch (permission) {
    case "users:invite":
      return hasCapability(actor, "users:invite", target.organizationId);
    case "users:manage":
      return hasCapability(actor, "users:manage", target.organizationId);
    case "teams:manage":
      return hasCapability(actor, "teams:manage", target.organizationId);
    case "users:grantRole":
      if (!target.role) {
        return false;
      }
      if (target.role === "admin") {
        return hasRole(actor, "admin", target.organizationId);
      }
      return hasCapability(actor, "users:manage", target.organizationId);
    case "music:read":
      return actor.roles.length > 0;
    case "music:write":
      return hasCapability(actor, "music:write", target.organizationId);
    case "import":
      return hasCapability(actor, "import", target.organizationId);
    default:
      return false;
  }
}
