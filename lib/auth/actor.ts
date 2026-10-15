import type {
  OrganizationRole,
  UserId,
  WorshipTeamId,
  WorshipTeamRole,
} from "@/types/identity";

/** Quem está agindo numa requisição. Toda checagem de permissão parte daqui. */
export type Actor =
  | { kind: "anonymous" }
  | {
      kind: "user";
      userId: UserId;
      organizationId: string;
      roles: ReadonlyArray<OrganizationRole>;
      teams: ReadonlyArray<{ teamId: WorshipTeamId; role: WorshipTeamRole }>;
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
