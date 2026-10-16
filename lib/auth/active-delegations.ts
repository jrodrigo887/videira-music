import type { PrismaClient } from "@prisma/client";

import type { DelegationGrant } from "./actor";
import { type Capability, isCapability } from "./capabilities";

function parseTeamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function parseDelegationCapabilities(raw: unknown): Capability[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is Capability => isCapability(String(entry)));
}

export async function loadActiveDelegations(
  prisma: PrismaClient,
  granteeUserId: string,
  now: Date,
): Promise<DelegationGrant[]> {
  const rows = await prisma.capabilityDelegation.findMany({
    where: {
      granteeUserId,
      revokedAt: null,
      startsAt: { lte: now },
      expiresAt: { gt: now },
    },
  });

  return rows.map((row) => ({
    capabilities: parseDelegationCapabilities(row.capabilities),
    teamIds: parseTeamIds(row.teamIds),
    expiresAt: row.expiresAt.toISOString(),
  }));
}
