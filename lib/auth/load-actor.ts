import type { PrismaClient } from "@prisma/client";

import type { WorshipTeamRole } from "@/types/identity";

import { loadActiveDelegations } from "./active-delegations";
import { ANONYMOUS_ACTOR, type Actor, type DelegationGrant } from "./actor";
import {
  closeCapabilities,
  parseStoredCapabilities,
  systemCapabilities,
  unionCapabilities,
} from "./capabilities";

const TEAM_ROLES: ReadonlySet<string> = new Set<WorshipTeamRole>(["leader", "member"]);

async function loadCustomRoleCapabilities(
  prisma: PrismaClient,
  organizationId: string,
  keys: readonly string[],
): Promise<Map<string, readonly import("./capabilities").Capability[]>> {
  if (keys.length === 0) {
    return new Map();
  }
  const rows = await prisma.roleDefinition.findMany({
    where: {
      organizationId,
      key: { in: [...keys] },
      system: false,
    },
    select: { key: true, capabilities: true },
  });
  const map = new Map<string, readonly import("./capabilities").Capability[]>();
  for (const row of rows) {
    map.set(row.key, parseStoredCapabilities(row.capabilities));
  }
  return map;
}

async function mapUserToActor(
  prisma: PrismaClient,
  user: {
    id: string;
    organizationId: string;
    status: string;
    roles: { role: string }[];
    teamMemberships: { teamId: string; role: string }[];
  },
  delegations: readonly DelegationGrant[],
): Promise<Actor> {
  if (user.status !== "active") {
    return ANONYMOUS_ACTOR;
  }

  const rawKeys = user.roles.map((entry) => entry.role);
  const customKeys = new Set(
    rawKeys.filter((key) => systemCapabilities(key) === undefined),
  );
  const customCaps = await loadCustomRoleCapabilities(prisma, user.organizationId, [...customKeys]);

  const roles = rawKeys.filter(
    (key) => systemCapabilities(key) !== undefined || customCaps.has(key),
  );

  if (roles.length === 0) {
    return ANONYMOUS_ACTOR;
  }

  const capabilityGroups = roles.map((key) => {
    const preset = systemCapabilities(key);
    if (preset) {
      return preset;
    }
    return customCaps.get(key) ?? [];
  });

  return {
    kind: "user",
    userId: user.id,
    organizationId: user.organizationId,
    roles,
    capabilities: closeCapabilities(unionCapabilities(capabilityGroups)),
    teams: user.teamMemberships
      .filter((membership) => TEAM_ROLES.has(membership.role))
      .map((membership) => ({
        teamId: membership.teamId,
        role: membership.role as WorshipTeamRole,
      })),
    delegations,
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
  const delegations = await loadActiveDelegations(prisma, user.id, new Date());
  return mapUserToActor(prisma, user, delegations);
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
  const delegations = await loadActiveDelegations(prisma, user.id, new Date());
  return mapUserToActor(prisma, user, delegations);
}
