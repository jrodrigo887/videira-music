import type { Prisma, PrismaClient } from "@prisma/client";

type RoleDb = PrismaClient | Prisma.TransactionClient;

import type { UserActor } from "@/lib/auth/actor";
import {
  ADMIN_ONLY_CAPABILITIES,
  type Capability,
  closeCapabilities,
  isCapability,
  parseStoredCapabilities,
  systemCapabilities,
  unionCapabilities,
} from "@/lib/auth/capabilities";
import { can } from "@/lib/auth/permissions";

import { roleKeyFromLabel, validateRoleLabel } from "./role-key";

export type RoleRecord = {
  key: string;
  label: string;
  system: boolean;
  capabilities: Capability[];
};

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  worship_leader: "Líder de louvor",
  musician: "Músico",
};

async function writeAudit(
  prisma: PrismaClient,
  entry: {
    actorUserId?: string;
    action: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.authAuditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      details: (entry.details ?? {}) as object,
    },
  });
}

export async function ensureSystemRoles(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  for (const [key, label] of Object.entries(SYSTEM_ROLE_LABELS)) {
    await prisma.roleDefinition.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: {
        organizationId,
        key,
        label,
        system: true,
        capabilities: [],
      },
      update: { label, system: true },
    });
  }
}

function toRoleRecord(row: {
  key: string;
  label: string;
  system: boolean;
  capabilities: unknown;
}): RoleRecord {
  const stored = parseStoredCapabilities(row.capabilities);
  return {
    key: row.key,
    label: row.label,
    system: row.system,
    capabilities: row.system
      ? [...(systemCapabilities(row.key) ?? [])]
      : stored,
  };
}

function assertNoAdminOnlyCapabilities(capabilities: readonly Capability[]): void {
  if (capabilities.some((cap) => ADMIN_ONLY_CAPABILITIES.includes(cap))) {
    throw roleError(409, "ADMIN_ONLY_CAPABILITY");
  }
}

export async function listRoleLabels(
  prisma: PrismaClient,
  actor: UserActor,
): Promise<Array<{ key: string; label: string }>> {
  const orgId = actor.organizationId;
  const allowed =
    can(actor, "member.manage", { organizationId: orgId }) ||
    can(actor, "user.manage", { organizationId: orgId }) ||
    can(actor, "role.manage", { organizationId: orgId });
  if (!allowed) {
    throw roleError(403, "FORBIDDEN");
  }
  await ensureSystemRoles(prisma, orgId);
  const rows = await prisma.roleDefinition.findMany({
    where: { organizationId: orgId },
    orderBy: [{ system: "desc" }, { label: "asc" }],
    select: { key: true, label: true },
  });
  return rows;
}

export async function listRoles(prisma: PrismaClient, actor: UserActor): Promise<RoleRecord[]> {
  if (!can(actor, "role.manage", { organizationId: actor.organizationId })) {
    throw roleError(403, "FORBIDDEN");
  }
  await ensureSystemRoles(prisma, actor.organizationId);
  const rows = await prisma.roleDefinition.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ system: "desc" }, { label: "asc" }],
  });
  return rows.map(toRoleRecord);
}

export async function isAssignableRole(
  prisma: RoleDb,
  organizationId: string,
  key: string,
): Promise<boolean> {
  if (systemCapabilities(key) !== undefined) {
    return true;
  }
  const row = await prisma.roleDefinition.findUnique({
    where: { organizationId_key: { organizationId, key } },
    select: { system: true },
  });
  return row !== null && !row.system;
}

export async function resolveCapabilitiesForRoleKeys(
  prisma: RoleDb,
  organizationId: string,
  keys: readonly string[],
): Promise<Capability[]> {
  const groups: Capability[][] = [];
  const customKeys = keys.filter((key) => systemCapabilities(key) === undefined);
  const customRows =
    customKeys.length > 0
      ? await prisma.roleDefinition.findMany({
          where: { organizationId, key: { in: customKeys }, system: false },
          select: { key: true, capabilities: true },
        })
      : [];
  const customMap = new Map(customRows.map((row) => [row.key, parseStoredCapabilities(row.capabilities)]));

  for (const key of keys) {
    const preset = systemCapabilities(key);
    if (preset) {
      groups.push([...preset]);
    } else {
      groups.push(customMap.get(key) ?? []);
    }
  }
  return unionCapabilities(groups);
}

export async function createRole(
  prisma: PrismaClient,
  actor: UserActor,
  input: { label: string; capabilities: string[] },
): Promise<RoleRecord> {
  if (!can(actor, "role.manage", { organizationId: actor.organizationId })) {
    throw roleError(403, "FORBIDDEN");
  }

  validateRoleLabel(input.label);
  const label = input.label.trim();
  const capabilities = input.capabilities.filter(isCapability);
  if (capabilities.length !== input.capabilities.length) {
    throw roleError(400, "INVALID_ROLE");
  }
  assertNoAdminOnlyCapabilities(capabilities);
  const storedCapabilities = closeCapabilities(capabilities);

  const key = roleKeyFromLabel(label);

  const existingLabel = await prisma.roleDefinition.findFirst({
    where: {
      organizationId: actor.organizationId,
      label: { equals: label, mode: "insensitive" },
    },
  });
  if (existingLabel) {
    throw roleError(409, "ROLE_EXISTS");
  }

  const existingKey = await prisma.roleDefinition.findUnique({
    where: { organizationId_key: { organizationId: actor.organizationId, key } },
  });
  if (existingKey) {
    throw roleError(409, "ROLE_EXISTS");
  }

  const row = await prisma.roleDefinition.create({
    data: {
      organizationId: actor.organizationId,
      key,
      label,
      system: false,
      capabilities: storedCapabilities,
    },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "role.create",
    details: { key, label, capabilities: storedCapabilities },
  });

  return toRoleRecord(row);
}

export async function updateRole(
  prisma: PrismaClient,
  actor: UserActor,
  key: string,
  input: { label?: string; capabilities?: string[] },
): Promise<RoleRecord> {
  if (!can(actor, "role.manage", { organizationId: actor.organizationId })) {
    throw roleError(403, "FORBIDDEN");
  }

  const existing = await prisma.roleDefinition.findUnique({
    where: { organizationId_key: { organizationId: actor.organizationId, key } },
  });
  if (!existing) {
    throw roleError(404, "NOT_FOUND");
  }
  if (existing.system) {
    throw roleError(409, "SYSTEM_ROLE");
  }

  let label = existing.label;
  if (input.label !== undefined) {
    validateRoleLabel(input.label);
    label = input.label.trim();
    const duplicate = await prisma.roleDefinition.findFirst({
      where: {
        organizationId: actor.organizationId,
        label: { equals: label, mode: "insensitive" },
        NOT: { key },
      },
    });
    if (duplicate) {
      throw roleError(409, "ROLE_EXISTS");
    }
  }

  let capabilities = parseStoredCapabilities(existing.capabilities);
  if (input.capabilities !== undefined) {
    capabilities = input.capabilities.filter(isCapability);
    if (capabilities.length !== input.capabilities.length) {
      throw roleError(400, "INVALID_ROLE");
    }
    assertNoAdminOnlyCapabilities(capabilities);
    capabilities = closeCapabilities(capabilities);
  }

  const row = await prisma.roleDefinition.update({
    where: { organizationId_key: { organizationId: actor.organizationId, key } },
    data: { label, capabilities },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "role.update",
    details: { key, label, capabilities },
  });

  return toRoleRecord(row);
}

export async function deleteRole(
  prisma: PrismaClient,
  actor: UserActor,
  key: string,
): Promise<void> {
  if (!can(actor, "role.manage", { organizationId: actor.organizationId })) {
    throw roleError(403, "FORBIDDEN");
  }

  const existing = await prisma.roleDefinition.findUnique({
    where: { organizationId_key: { organizationId: actor.organizationId, key } },
  });
  if (!existing) {
    throw roleError(404, "NOT_FOUND");
  }
  if (existing.system) {
    throw roleError(409, "SYSTEM_ROLE");
  }

  const inUseMember = await prisma.userRole.count({
    where: {
      role: key,
      user: { organizationId: actor.organizationId },
    },
  });
  if (inUseMember > 0) {
    throw roleError(409, "ROLE_IN_USE");
  }

  const pendingInvites = await prisma.invite.findMany({
    where: {
      organizationId: actor.organizationId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { roles: true },
  });
  for (const invite of pendingInvites) {
    const roles = Array.isArray(invite.roles) ? invite.roles.map(String) : [];
    if (roles.includes(key)) {
      throw roleError(409, "ROLE_IN_USE");
    }
  }

  await prisma.roleDefinition.delete({
    where: { organizationId_key: { organizationId: actor.organizationId, key } },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "role.delete",
    details: { key },
  });
}

export class RoleServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "RoleServiceError";
  }
}

function roleError(status: number, code: string): RoleServiceError {
  return new RoleServiceError(status, code);
}

export function isRoleServiceError(error: unknown): error is RoleServiceError {
  return error instanceof RoleServiceError;
}
