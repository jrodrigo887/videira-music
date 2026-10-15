import type { OrganizationRole } from "@/types/identity";

import type { Actor } from "./actor";
import { hasRole, isOrganizationManager } from "./actor";

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
  target: { organizationId: string; role?: OrganizationRole },
): boolean {
  if (actor.kind !== "user" || actor.organizationId !== target.organizationId) {
    return false;
  }

  switch (permission) {
    case "users:invite":
    case "users:manage":
    case "teams:manage":
      return isOrganizationManager(actor, target.organizationId);
    case "users:grantRole":
      if (!target.role) {
        return false;
      }
      if (target.role === "admin") {
        return hasRole(actor, "admin", target.organizationId);
      }
      return isOrganizationManager(actor, target.organizationId);
    case "music:read":
      return actor.roles.length > 0;
    case "music:write":
    case "import":
      return (
        hasRole(actor, "admin", target.organizationId) ||
        hasRole(actor, "manager", target.organizationId) ||
        hasRole(actor, "worship_leader", target.organizationId)
      );
    default:
      return false;
  }
}
