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
      role: OrganizationRole;
      teams: ReadonlyArray<{ teamId: WorshipTeamId; role: WorshipTeamRole }>;
    };

export const ANONYMOUS_ACTOR: Actor = { kind: "anonymous" };

export function isOrganizationAdmin(actor: Actor, organizationId: string): boolean {
  return (
    actor.kind === "user" && actor.organizationId === organizationId && actor.role === "admin"
  );
}

export function teamRoleOf(actor: Actor, teamId: WorshipTeamId): WorshipTeamRole | undefined {
  if (actor.kind !== "user") {
    return undefined;
  }
  return actor.teams.find((team) => team.teamId === teamId)?.role;
}
