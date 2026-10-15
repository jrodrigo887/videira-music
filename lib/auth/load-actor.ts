import type { PrismaClient } from "@prisma/client";

import type { OrganizationRole, WorshipTeamRole } from "@/types/identity";

import { ANONYMOUS_ACTOR, type Actor } from "./actor";

const ORGANIZATION_ROLES: ReadonlySet<string> = new Set<OrganizationRole>([
  "admin",
  "manager",
  "worship_leader",
  "musician",
]);
const TEAM_ROLES: ReadonlySet<string> = new Set<WorshipTeamRole>(["leader", "member"]);

function mapUserToActor(user: {
  id: string;
  organizationId: string;
  status: string;
  roles: { role: string }[];
  teamMemberships: { teamId: string; role: string }[];
}): Actor {
  if (user.status !== "active") {
    return ANONYMOUS_ACTOR;
  }

  const roles = user.roles
    .map((entry) => entry.role)
    .filter((role): role is OrganizationRole => ORGANIZATION_ROLES.has(role));

  if (roles.length === 0) {
    return ANONYMOUS_ACTOR;
  }

  return {
    kind: "user",
    userId: user.id,
    organizationId: user.organizationId,
    roles,
    teams: user.teamMemberships
      .filter((membership) => TEAM_ROLES.has(membership.role))
      .map((membership) => ({
        teamId: membership.teamId,
        role: membership.role as WorshipTeamRole,
      })),
  };
}

const userInclude = {
  roles: { select: { role: true } },
  teamMemberships: {
    where: { team: { archivedAt: null } },
    select: { teamId: true, role: true },
  },
} as const;

/** Monta o `Actor` de um usuário; usuário inexistente ou inativo vira anônimo. */
export async function loadActorForUser(prisma: PrismaClient, userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });
  if (!user) {
    return ANONYMOUS_ACTOR;
  }
  return mapUserToActor(user);
}

export async function loadActorForAuthUserId(
  prisma: PrismaClient,
  authUserId: string,
): Promise<Actor> {
  const user = await prisma.user.findFirst({
    where: { authUserId, status: "active" },
    include: userInclude,
  });
  if (!user) {
    return ANONYMOUS_ACTOR;
  }
  return mapUserToActor(user);
}
