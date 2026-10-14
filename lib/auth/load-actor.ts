import type { PrismaClient } from "@prisma/client";

import type { OrganizationRole, WorshipTeamRole } from "@/types/identity";

import { ANONYMOUS_ACTOR, type Actor } from "./actor";

const ORGANIZATION_ROLES: ReadonlySet<string> = new Set<OrganizationRole>(["admin", "member"]);
const TEAM_ROLES: ReadonlySet<string> = new Set<WorshipTeamRole>(["leader", "member"]);

/** Monta o `Actor` de um usuário; usuário inexistente vira anônimo. Grupos arquivados não contam. */
export async function loadActorForUser(prisma: PrismaClient, userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      teamMemberships: {
        where: { team: { archivedAt: null } },
        select: { teamId: true, role: true },
      },
    },
  });

  if (!user || !ORGANIZATION_ROLES.has(user.role)) {
    return ANONYMOUS_ACTOR;
  }

  return {
    kind: "user",
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role as OrganizationRole,
    teams: user.teamMemberships
      .filter((membership) => TEAM_ROLES.has(membership.role))
      .map((membership) => ({
        teamId: membership.teamId,
        role: membership.role as WorshipTeamRole,
      })),
  };
}
