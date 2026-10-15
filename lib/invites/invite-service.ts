import type { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import type { UserActor } from "@/lib/auth/actor";
import { normalizeEmail } from "@/lib/auth/email";
import { can } from "@/lib/auth/permissions";
import type { OrganizationRole } from "@/types/identity";

import { generateInviteCode, hashInviteCode } from "./invite-token";
import { reconcileSoleWorshipLeader } from "@/lib/members/member-service";

const ORGANIZATION_ROLES: ReadonlySet<string> = new Set([
  "admin",
  "manager",
  "worship_leader",
  "musician",
]);

const MIN_EXPIRY_MS = 60 * 60 * 1000;
const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export type InviteSummary = {
  id: string;
  email: string;
  roles: OrganizationRole[];
  teamIds: string[];
  expiresAt: string;
  createdByUserId: string;
  createdByName?: string;
};

export type InvitePreview = {
  email: string;
  roles: OrganizationRole[];
  teamIds: string[];
  expiresAt: string;
};

function parseRoles(raw: unknown): OrganizationRole[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((role): role is OrganizationRole => ORGANIZATION_ROLES.has(String(role)));
}

function parseTeamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(String);
}

async function writeAudit(
  prisma: PrismaClient,
  entry: {
    actorUserId?: string;
    action: string;
    targetEmail?: string;
    targetUserId?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.authAuditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetEmail: entry.targetEmail,
      targetUserId: entry.targetUserId,
      details: (entry.details ?? {}) as object,
    },
  });
}

export async function createInvite(
  prisma: PrismaClient,
  actor: UserActor,
  input: {
    email: string;
    roles: OrganizationRole[];
    teamIds: string[];
    expiresInHours: number;
  },
): Promise<{ invite: InviteSummary; link: string; code: string }> {
  if (!can(actor, "users:invite", { organizationId: actor.organizationId })) {
    throw inviteError(403, "FORBIDDEN");
  }
  if (input.roles.some((role) => role === "admin") && !can(actor, "users:grantRole", { organizationId: actor.organizationId, role: "admin" })) {
    throw inviteError(403, "FORBIDDEN");
  }
  if (input.roles.length === 0 || input.roles.some((role) => !ORGANIZATION_ROLES.has(role))) {
    throw inviteError(400, "INVALID_REQUEST");
  }

  const expiresMs = input.expiresInHours * 60 * 60 * 1000;
  if (expiresMs < MIN_EXPIRY_MS || expiresMs > MAX_EXPIRY_MS) {
    throw inviteError(400, "INVALID_EXPIRY");
  }

  const email = normalizeEmail(input.email);
  if (!email.includes("@")) {
    throw inviteError(400, "INVALID_REQUEST");
  }

  const existingUser = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, email, status: "active" },
  });
  if (existingUser) {
    throw inviteError(409, "USER_EXISTS");
  }

  const teams = await prisma.worshipTeam.findMany({
    where: {
      organizationId: actor.organizationId,
      archivedAt: null,
      id: { in: input.teamIds },
    },
    select: { id: true },
  });
  const teamIds = teams.map((team) => team.id);

  await prisma.invite.updateMany({
    where: {
      organizationId: actor.organizationId,
      email,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  const { code, hash } = generateInviteCode();
  const expiresAt = new Date(Date.now() + expiresMs);

  const invite = await prisma.invite.create({
    data: {
      organizationId: actor.organizationId,
      email,
      tokenHash: hash,
      roles: input.roles,
      teamIds,
      expiresAt,
      createdByUserId: actor.userId,
    },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "invite.create",
    targetEmail: email,
    details: { roles: input.roles, teamIds },
  });

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      roles: input.roles,
      teamIds,
      expiresAt: invite.expiresAt.toISOString(),
      createdByUserId: invite.createdByUserId,
    },
    link: `/convite/${code}`,
    code,
  };
}

export async function listPendingInvites(
  prisma: PrismaClient,
  actor: UserActor,
): Promise<InviteSummary[]> {
  if (!can(actor, "users:invite", { organizationId: actor.organizationId })) {
    throw inviteError(403, "FORBIDDEN");
  }
  const now = new Date();
  const rows = await prisma.invite.findMany({
    where: {
      organizationId: actor.organizationId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  const creatorIds = [...new Set(rows.map((row) => row.createdByUserId))];
  const creators =
    creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true },
        })
      : [];
  const creatorNames = new Map(creators.map((user) => [user.id, user.name]));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    roles: parseRoles(row.roles),
    teamIds: parseTeamIds(row.teamIds),
    expiresAt: row.expiresAt.toISOString(),
    createdByUserId: row.createdByUserId,
    createdByName: creatorNames.get(row.createdByUserId),
  }));
}

export async function revokeInvite(
  prisma: PrismaClient,
  actor: UserActor,
  inviteId: string,
): Promise<void> {
  if (!can(actor, "users:invite", { organizationId: actor.organizationId })) {
    throw inviteError(403, "FORBIDDEN");
  }
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, organizationId: actor.organizationId },
  });
  if (!invite || invite.usedAt || invite.revokedAt) {
    throw inviteError(404, "NOT_FOUND");
  }
  await prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });
  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "invite.revoke",
    targetEmail: invite.email,
  });
}

export async function findValidInviteByCode(
  prisma: PrismaClient,
  code: string,
  now = new Date(),
): Promise<(InvitePreview & { id: string; organizationId: string }) | undefined> {
  const hash = hashInviteCode(code);
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hash } });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) {
    return undefined;
  }
  return {
    id: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    roles: parseRoles(invite.roles),
    teamIds: parseTeamIds(invite.teamIds),
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function acceptInvite(
  prisma: PrismaClient,
  input: {
    code: string;
    authUserId: string;
    email: string;
    name: string;
    image?: string | null;
  },
  now = new Date(),
): Promise<"accepted" | "invalid" | "email_mismatch"> {
  const normalizedEmail = normalizeEmail(input.email);
  const hash = hashInviteCode(input.code);
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hash } });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now) {
    return "invalid";
  }
  if (normalizeEmail(invite.email) !== normalizedEmail) {
    return "email_mismatch";
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.invite.updateMany({
      where: {
        tokenHash: hash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (updated.count === 0) {
      return "invalid" as const;
    }

    const roles = parseRoles(invite.roles);
    const teamIds = parseTeamIds(invite.teamIds);
    const activeTeams = await tx.worshipTeam.findMany({
      where: {
        organizationId: invite.organizationId,
        archivedAt: null,
        id: { in: teamIds },
      },
      select: { id: true },
    });

    const userId = uuidv4();
    await tx.user.create({
      data: {
        id: userId,
        organizationId: invite.organizationId,
        authUserId: input.authUserId,
        name: input.name,
        email: normalizedEmail,
        status: "active",
        roles: { create: roles.map((role) => ({ role })) },
        teamMemberships: {
          create: activeTeams.map((team) => ({
            teamId: team.id,
            role: roles.includes("worship_leader") ? "leader" : "member",
          })),
        },
      },
    });

    await tx.invite.update({
      where: { tokenHash: hash },
      data: { usedByUserId: userId },
    });
    await reconcileSoleWorshipLeader(tx, invite.organizationId);
    return { status: "accepted" as const, userId };
  });

  if (result === "invalid") {
    return "invalid";
  }

  await writeAudit(prisma, {
    action: "invite.accept",
    targetEmail: normalizedEmail,
    targetUserId: result.userId,
  });

  return "accepted";
}

export async function bootstrapAdminUser(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    authUserId: string;
    email: string;
    name: string;
  },
): Promise<boolean> {
  const adminCount = await prisma.userRole.count({
    where: {
      role: "admin",
      user: { organizationId: input.organizationId, status: "active" },
    },
  });
  if (adminCount > 0) {
    return false;
  }

  const userId = uuidv4();
  await prisma.user.create({
    data: {
      id: userId,
      organizationId: input.organizationId,
      authUserId: input.authUserId,
      name: input.name,
      email: normalizeEmail(input.email),
      status: "active",
      roles: { create: [{ role: "admin" }] },
    },
  });

  await writeAudit(prisma, {
    action: "bootstrap.admin",
    targetEmail: normalizeEmail(input.email),
    targetUserId: userId,
  });

  return true;
}

export async function findActiveMemberByEmail(
  prisma: PrismaClient,
  organizationId: string,
  email: string,
): Promise<{ id: string; status: string } | undefined> {
  const user = await prisma.user.findFirst({
    where: { organizationId, email: normalizeEmail(email) },
    select: { id: true, status: true },
  });
  return user ?? undefined;
}

export async function linkAuthUserToMember(
  prisma: PrismaClient,
  memberId: string,
  authUserId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: memberId },
    data: { authUserId },
  });
}

export class InviteServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "InviteServiceError";
  }
}

function inviteError(status: number, code: string): InviteServiceError {
  return new InviteServiceError(status, code);
}

export function isInviteServiceError(error: unknown): error is InviteServiceError {
  return error instanceof InviteServiceError;
}
