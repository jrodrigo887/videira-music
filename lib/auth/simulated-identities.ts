import type { PrismaClient } from "@prisma/client";

import type { User, WorshipTeam, WorshipTeamMembership } from "@/types/identity";

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

export const SIMULATED_USERS: readonly User[] = [
  {
    id: "user-admin",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Admin Videira",
    email: "admin@videira.test",
    role: "admin",
  },
  {
    id: "user-leader",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Líder do Louvor",
    email: "lider@videira.test",
    role: "member",
  },
  {
    id: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Músico",
    email: "musico@videira.test",
    role: "member",
  },
];

export const SIMULATED_TEAMS: readonly WorshipTeam[] = [
  { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" },
  { id: "team-jovens", organizationId: DEFAULT_ORGANIZATION_ID, slug: "jovens", name: "Jovens" },
];

export const SIMULATED_MEMBERSHIPS: readonly WorshipTeamMembership[] = [
  { teamId: "team-louvor", userId: "user-leader", role: "leader" },
  { teamId: "team-louvor", userId: "user-musician", role: "member" },
  { teamId: "team-jovens", userId: "user-musician", role: "member" },
];

/** Idempotente: só insere o que falta, sem sobrescrever edições. */
export async function seedSimulatedIdentities(prisma: PrismaClient): Promise<void> {
  for (const user of SIMULATED_USERS) {
    await prisma.user.upsert({ where: { id: user.id }, create: user, update: {} });
  }
  for (const team of SIMULATED_TEAMS) {
    await prisma.worshipTeam.upsert({ where: { id: team.id }, create: team, update: {} });
  }
  for (const membership of SIMULATED_MEMBERSHIPS) {
    await prisma.worshipTeamMember.upsert({
      where: { teamId_userId: { teamId: membership.teamId, userId: membership.userId } },
      create: membership,
      update: {},
    });
  }
}
