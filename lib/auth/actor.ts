import type { Capability } from "@/lib/auth/capabilities";
import type {
  OrganizationRole,
  UserId,
  WorshipTeamId,
  WorshipTeamRole,
} from "@/types/identity";

export type DelegationGrant = {
  capabilities: ReadonlyArray<Capability>;
  teamIds: ReadonlyArray<string>;
  expiresAt: string;
};

/** Quem está agindo numa requisição. Toda checagem de permissão parte daqui. */
export type Actor =
  | { kind: "anonymous" }
  | {
      kind: "user";
      userId: UserId;
      organizationId: string;
      roles: ReadonlyArray<string>;
      capabilities: ReadonlyArray<Capability>;
      teams: ReadonlyArray<{ teamId: WorshipTeamId; role: WorshipTeamRole }>;
      delegations: ReadonlyArray<DelegationGrant>;
      viewAs?: { realUserId: UserId; expiresAt: string };
    };

export type UserActor = Extract<Actor, { kind: "user" }>;

export const ANONYMOUS_ACTOR: Actor = { kind: "anonymous" };

export function hasRole(
  actor: Actor,
  role: OrganizationRole,
  organizationId: string,
): boolean {
  return (
    actor.kind === "user" &&
    actor.organizationId === organizationId &&
    actor.roles.includes(role)
  );
}

export function hasCapability(
  actor: Actor,
  capability: Capability,
  organizationId: string,
): boolean {
  return (
    actor.kind === "user" &&
    actor.organizationId === organizationId &&
    actor.capabilities.includes(capability)
  );
}

export function isOrganizationAdmin(actor: Actor, organizationId: string): boolean {
  return hasRole(actor, "admin", organizationId);
}

export function isOrganizationManager(actor: Actor, organizationId: string): boolean {
  return (
    hasRole(actor, "admin", organizationId) || hasRole(actor, "manager", organizationId)
  );
}

export function teamRoleOf(actor: Actor, teamId: WorshipTeamId): WorshipTeamRole | undefined {
  if (actor.kind !== "user") {
    return undefined;
  }
  return actor.teams.find((team) => team.teamId === teamId)?.role;
}

export function earliestDelegationExpiry(actor: Actor): string | undefined {
  if (actor.kind !== "user" || actor.delegations.length === 0) {
    return undefined;
  }
  let earliest = actor.delegations[0].expiresAt;
  for (const grant of actor.delegations.slice(1)) {
    if (grant.expiresAt < earliest) {
      earliest = grant.expiresAt;
    }
  }
  return earliest;
}
