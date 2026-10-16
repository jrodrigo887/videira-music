import type { Prisma, PrismaClient } from "@prisma/client";

import type { UserActor } from "@/lib/auth/actor";
import { can } from "@/lib/auth/permissions";
import { hasCapability } from "@/lib/auth/actor";
import { loadActorForUser } from "@/lib/auth/load-actor";
import { isAssignableRole } from "@/lib/roles/role-service";
import type { OrganizationRole } from "@/types/identity";

type Tx = Prisma.TransactionClient;

export async function reconcileSoleWorshipLeader(
  tx: Tx | PrismaClient,
  organizationId: string,
): Promise<void> {
  const leaders = await tx.user.findMany({
    where: {
      organizationId,
      status: "active",
      roles: { some: { role: "worship_leader" } },
    },
    select: { id: true },
  });

  if (leaders.length !== 1) {
    return;
  }

  const leaderId = leaders[0]!.id;
  const teams = await tx.worshipTeam.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true },
  });

  for (const team of teams) {
    await tx.worshipTeamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: leaderId } },
      create: { teamId: team.id, userId: leaderId, role: "leader" },
      update: { role: "leader" },
    });
  }
}

export async function listMembers(prisma: PrismaClient, actor: UserActor) {
  if (!can(actor, "member.manage", { organizationId: actor.organizationId })) {
    throw memberError(403, "FORBIDDEN");
  }
  const users = await prisma.user.findMany({
    where: { organizationId: actor.organizationId },
    include: {
      roles: true,
      teamMemberships: { where: { team: { archivedAt: null } } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status as "active" | "deactivated",
    roles: user.roles.map((r) => r.role as OrganizationRole),
    teamIds: user.teamMemberships.map((m) => m.teamId),
  }));
}

export async function setMemberRoles(
  prisma: PrismaClient,
  actor: UserActor,
  userId: string,
  roles: string[],
): Promise<void> {
  if (!can(actor, "user.manage", { organizationId: actor.organizationId })) {
    throw memberError(403, "FORBIDDEN");
  }
  if (roles.length === 0) {
    throw memberError(400, "INVALID_ROLE");
  }
  for (const role of roles) {
    if (!(await isAssignableRole(prisma, actor.organizationId, role))) {
      throw memberError(400, "INVALID_ROLE");
    }
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    include: { roles: true },
  });
  if (!target) {
    throw memberError(404, "NOT_FOUND");
  }

  if (target.roles.some((r) => r.role === "admin") && !can(actor, "users:grantRole", { organizationId: actor.organizationId, role: "admin" })) {
    throw memberError(403, "FORBIDDEN");
  }

  for (const role of roles) {
    if (!can(actor, "users:grantRole", { organizationId: actor.organizationId, role })) {
      throw memberError(403, "FORBIDDEN");
    }
  }

  const hadAdmin = target.roles.some((r) => r.role === "admin");
  const willHaveAdmin = roles.includes("admin");
  if (hadAdmin && !willHaveAdmin) {
    const otherAdmins = await prisma.userRole.count({
      where: {
        role: "admin",
        user: { organizationId: actor.organizationId, status: "active", id: { not: userId } },
      },
    });
    if (otherAdmins === 0) {
      throw memberError(409, "LAST_ADMIN");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({ data: roles.map((role) => ({ userId, role })) });
    if (!roles.includes("worship_leader")) {
      await tx.worshipTeamMember.deleteMany({
        where: { userId, role: "leader" },
      });
    }
    await reconcileSoleWorshipLeader(tx, actor.organizationId);
  });

  await prisma.authAuditLog.create({
    data: {
      actorUserId: actor.userId,
      action: "roles.change",
      targetUserId: userId,
      details: { roles },
    },
  });
}

export async function setTeamLeaders(
  prisma: PrismaClient,
  actor: UserActor,
  teamId: string,
  userIds: string[],
): Promise<void> {
  if (!can(actor, "teams:manage", { organizationId: actor.organizationId })) {
    throw memberError(403, "FORBIDDEN");
  }

  const team = await prisma.worshipTeam.findFirst({
    where: {
      id: teamId,
      organizationId: actor.organizationId,
      archivedAt: null,
    },
  });
  if (!team) {
    throw memberError(404, "NOT_FOUND");
  }

  const leaderIds = [...new Set(userIds)];
  if (leaderIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: leaderIds },
        organizationId: actor.organizationId,
        status: "active",
      },
      include: { roles: true },
    });
    if (users.length !== leaderIds.length) {
      throw memberError(400, "INVALID_REQUEST");
    }
    for (const user of users) {
      const userActor = await loadActorForUser(prisma, user.id);
      if (!hasCapability(userActor, "setlists:led", actor.organizationId)) {
        throw memberError(400, "NOT_A_WORSHIP_LEADER");
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.worshipTeamMember.updateMany({
      where: { teamId, role: "leader" },
      data: { role: "member" },
    });
    for (const userId of leaderIds) {
      await tx.worshipTeamMember.upsert({
        where: { teamId_userId: { teamId, userId } },
        create: { teamId, userId, role: "leader" },
        update: { role: "leader" },
      });
    }
  });
}

export async function deactivateMember(
  prisma: PrismaClient,
  actor: UserActor,
  userId: string,
): Promise<void> {
  if (!can(actor, "user.manage", { organizationId: actor.organizationId })) {
    throw memberError(403, "FORBIDDEN");
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    include: { roles: true },
  });
  if (!target || target.status === "deactivated") {
    throw memberError(404, "NOT_FOUND");
  }

  if (target.roles.some((r) => r.role === "admin") && !can(actor, "users:grantRole", { organizationId: actor.organizationId, role: "admin" })) {
    throw memberError(403, "FORBIDDEN");
  }

  if (target.roles.some((r) => r.role === "admin")) {
    const otherAdmins = await prisma.userRole.count({
      where: {
        role: "admin",
        user: { organizationId: actor.organizationId, status: "active", id: { not: userId } },
      },
    });
    if (otherAdmins === 0) {
      throw memberError(409, "LAST_ADMIN");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "deactivated", deactivatedAt: new Date() },
    });
    await tx.worshipTeamMember.deleteMany({ where: { userId, role: "leader" } });
    if (target.authUserId) {
      await tx.authSession.deleteMany({ where: { userId: target.authUserId } });
    }
    await reconcileSoleWorshipLeader(tx, actor.organizationId);
  });

  await prisma.authAuditLog.create({
    data: {
      actorUserId: actor.userId,
      action: "user.deactivate",
      targetUserId: userId,
      details: {},
    },
  });
}

export class MemberServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "MemberServiceError";
  }
}

function memberError(status: number, code: string): MemberServiceError {
  return new MemberServiceError(status, code);
}

export function isMemberServiceError(error: unknown): error is MemberServiceError {
  return error instanceof MemberServiceError;
}
