import type { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import type { UserActor } from "@/lib/auth/actor";
import { hasRole } from "@/lib/auth/actor";
import { normalizeEmail } from "@/lib/auth/email";
import { can } from "@/lib/auth/permissions";
import { reconcileSoleWorshipLeader } from "@/lib/members/member-service";
import { isAssignableRole, resolveCapabilitiesForRoleKeys } from "@/lib/roles/role-service";

export type AccessRequestSummary = {
  id: string;
  email: string;
  name: string;
  requestedAt: string;
};

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

export async function submitAccessRequest(
  prisma: PrismaClient,
  organizationId: string,
  input: { email: string; name: string },
): Promise<void> {
  const email = normalizeEmail(input.email);
  const now = new Date();

  const existing = await prisma.accessRequest.findUnique({
    where: { organizationId_email: { organizationId, email } },
  });

  if (existing?.status === "approved") {
    return;
  }

  if (existing?.status === "pending") {
    await prisma.accessRequest.update({
      where: { id: existing.id },
      data: { name: input.name, requestedAt: now },
    });
  } else if (existing?.status === "rejected") {
    await prisma.accessRequest.update({
      where: { id: existing.id },
      data: { name: input.name, status: "pending", requestedAt: now, resolvedAt: null, resolvedByUserId: null },
    });
  } else {
    await prisma.accessRequest.create({
      data: {
        organizationId,
        email,
        name: input.name,
        status: "pending",
        requestedAt: now,
      },
    });
  }

  await writeAudit(prisma, {
    action: "access_request.create",
    targetEmail: email,
    details: { name: input.name },
  });
}

export async function listPendingAccessRequests(
  prisma: PrismaClient,
  actor: UserActor,
): Promise<AccessRequestSummary[]> {
  if (!can(actor, "users:manage", { organizationId: actor.organizationId })) {
    throw accessRequestError(403, "FORBIDDEN");
  }

  const rows = await prisma.accessRequest.findMany({
    where: { organizationId: actor.organizationId, status: "pending" },
    orderBy: { requestedAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    requestedAt: row.requestedAt.toISOString(),
  }));
}

async function validateApprovalInput(
  prisma: PrismaClient,
  actor: UserActor,
  roles: string[],
  teamIds: string[],
): Promise<{ capabilities: import("@/lib/auth/capabilities").Capability[]; teamIds: string[] }> {
  if (!can(actor, "users:manage", { organizationId: actor.organizationId })) {
    throw accessRequestError(403, "FORBIDDEN");
  }
  if (roles.length === 0) {
    throw accessRequestError(400, "INVALID_ROLE");
  }

  for (const role of roles) {
    if (role === "admin" && !hasRole(actor, "admin", actor.organizationId)) {
      throw accessRequestError(403, "FORBIDDEN");
    }
    if (!(await isAssignableRole(prisma, actor.organizationId, role))) {
      throw accessRequestError(400, "INVALID_ROLE");
    }
  }

  const capabilities = await resolveCapabilitiesForRoleKeys(prisma, actor.organizationId, roles);

  const teams =
    teamIds.length === 0
      ? []
      : await prisma.worshipTeam.findMany({
          where: {
            organizationId: actor.organizationId,
            archivedAt: null,
            id: { in: teamIds },
          },
          select: { id: true },
        });

  if (teamIds.length > 0 && teams.length !== teamIds.length) {
    throw accessRequestError(400, "INVALID_TEAM");
  }

  return { capabilities, teamIds: teams.map((team) => team.id) };
}

export async function approveAccessRequest(
  prisma: PrismaClient,
  actor: UserActor,
  requestId: string,
  input: { roles: string[]; teamIds: string[] },
): Promise<void> {
  const { capabilities, teamIds } = await validateApprovalInput(
    prisma,
    actor,
    input.roles,
    input.teamIds,
  );

  const hasSetlistsLed = capabilities.includes("setlists:led");

  await prisma.$transaction(async (tx) => {
    const claim = await tx.accessRequest.updateMany({
      where: {
        id: requestId,
        organizationId: actor.organizationId,
        status: "pending",
      },
      data: {
        status: "approved",
        resolvedAt: new Date(),
        resolvedByUserId: actor.userId,
      },
    });

    if (claim.count === 0) {
      const existing = await tx.accessRequest.findFirst({
        where: { id: requestId, organizationId: actor.organizationId },
      });
      if (!existing) {
        throw accessRequestError(404, "NOT_FOUND");
      }
      throw accessRequestError(409, "REQUEST_RESOLVED");
    }

    const request = await tx.accessRequest.findUniqueOrThrow({ where: { id: requestId } });
    const email = normalizeEmail(request.email);

    const activeUser = await tx.user.findFirst({
      where: { organizationId: actor.organizationId, email, status: "active" },
    });
    if (activeUser) {
      throw accessRequestError(409, "USER_EXISTS");
    }

    const deactivated = await tx.user.findFirst({
      where: { organizationId: actor.organizationId, email, status: "deactivated" },
    });
    if (deactivated) {
      throw accessRequestError(409, "USER_DEACTIVATED");
    }

    const userId = uuidv4();
    await tx.user.create({
      data: {
        id: userId,
        organizationId: actor.organizationId,
        name: request.name,
        email,
        status: "active",
        roles: { create: input.roles.map((role) => ({ role })) },
        teamMemberships: {
          create: teamIds.map((teamId) => ({
            teamId,
            role: hasSetlistsLed ? "leader" : "member",
          })),
        },
      },
    });

    await tx.accessRequest.update({
      where: { id: requestId },
      data: { createdUserId: userId },
    });

    if (input.roles.includes("worship_leader")) {
      await reconcileSoleWorshipLeader(tx, actor.organizationId);
    }
  });

  const request = await prisma.accessRequest.findUniqueOrThrow({ where: { id: requestId } });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "access_request.approve",
    targetEmail: request.email,
    targetUserId: request.createdUserId ?? undefined,
    details: { roles: input.roles, teamIds },
  });
}

export async function rejectAccessRequest(
  prisma: PrismaClient,
  actor: UserActor,
  requestId: string,
): Promise<void> {
  if (!can(actor, "users:manage", { organizationId: actor.organizationId })) {
    throw accessRequestError(403, "FORBIDDEN");
  }

  const updated = await prisma.accessRequest.updateMany({
    where: {
      id: requestId,
      organizationId: actor.organizationId,
      status: "pending",
    },
    data: {
      status: "rejected",
      resolvedAt: new Date(),
      resolvedByUserId: actor.userId,
    },
  });

  if (updated.count === 0) {
    throw accessRequestError(409, "REQUEST_RESOLVED");
  }

  const request = await prisma.accessRequest.findUniqueOrThrow({ where: { id: requestId } });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "access_request.reject",
    targetEmail: request.email,
  });
}

export class AccessRequestServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "AccessRequestServiceError";
  }
}

function accessRequestError(status: number, code: string): AccessRequestServiceError {
  return new AccessRequestServiceError(status, code);
}

export function isAccessRequestServiceError(error: unknown): error is AccessRequestServiceError {
  return error instanceof AccessRequestServiceError;
}
