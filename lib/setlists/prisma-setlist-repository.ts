import type { PrismaClient } from "@prisma/client";

import { toPrismaChartCreate, toPrismaSongCreate } from "@/lib/persistence/persistence-utils";

import type {
  ClonePlan,
  NewSetlist,
  NewSetlistItem,
  SetlistItemRecord,
  SetlistListFilter,
  SetlistMetaPatch,
  SetlistRecord,
  SetlistRepository,
} from "./setlist-repository";
import { SetlistVersionConflictError } from "./setlist-repository";

const setlistInclude = {
  items: {
    orderBy: { position: "asc" as const },
    include: {
      song: {
        select: { title: true, artist: true, sourceOrganizationId: true, deletedAt: true },
      },
      chart: { select: { key: true, originUrl: true, sourceOrganizationId: true } },
    },
  },
  follows: { select: { teamId: true } },
};

type SetlistRow = Awaited<
  ReturnType<PrismaClient["setlist"]["findFirst"]>
> & {
  items: Array<{
    id: string;
    position: number;
    kind: string;
    songId: string | null;
    chartId: string | null;
    selectedKey: string | null;
    text: string | null;
    notes: string | null;
    song: {
      title: string;
      artist: string | null;
      sourceOrganizationId: string | null;
      deletedAt: Date | null;
    } | null;
    chart: { key: string; originUrl: string | null; sourceOrganizationId: string | null } | null;
  }>;
  follows: Array<{ teamId: string }>;
};

function toItemRecord(row: SetlistRow["items"][number]): SetlistItemRecord {
  if (row.kind === "note") {
    return {
      id: row.id,
      kind: "note",
      position: row.position,
      text: row.text ?? "",
      ...(row.notes ? { notes: row.notes } : {}),
    };
  }

  const imported = Boolean(row.chart?.sourceOrganizationId ?? row.song?.sourceOrganizationId);
  return {
    id: row.id,
    kind: "song",
    position: row.position,
    songId: row.songId!,
    chartId: row.chartId!,
    selectedKey: row.selectedKey!,
    songTitle: row.song?.title ?? "",
    ...(row.song?.artist ? { songArtist: row.song.artist } : {}),
    ...(row.song?.deletedAt ? { songDeletedAt: row.song.deletedAt.toISOString() } : {}),
    chartKey: row.chart?.key ?? "",
    ...(row.chart?.originUrl ? { originUrl: row.chart.originUrl } : {}),
    imported,
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

function toSetlistRecord(row: SetlistRow): SetlistRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerTeamId: row.ownerTeamId,
    ownerUserId: row.ownerUserId,
    createdByUserId: row.createdByUserId,
    title: row.title,
    ...(row.eventType ? { eventType: row.eventType as SetlistRecord["eventType"] } : {}),
    ...(row.eventAt ? { eventAt: row.eventAt.toISOString() } : {}),
    status: row.status as SetlistRecord["status"],
    visibility: row.visibility as SetlistRecord["visibility"],
    ...(row.notes ? { notes: row.notes } : {}),
    version: row.version,
    ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
    followerTeamIds: row.follows.map((follow) => follow.teamId),
    items: row.items.map(toItemRecord),
  };
}

function buildListWhere(filter: SetlistListFilter) {
  return {
    organizationId: filter.organizationId,
    deletedAt: null,
    ...(filter.ownerTeamId !== undefined ? { ownerTeamId: filter.ownerTeamId } : {}),
    ...(filter.includeArchived ? {} : { status: { not: "archived" } }),
  };
}

export class PrismaSetlistRepository implements SetlistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SetlistRecord | undefined> {
    const row = await this.prisma.setlist.findFirst({
      where: { id },
      include: setlistInclude,
    });
    return row ? toSetlistRecord(row as SetlistRow) : undefined;
  }

  async list(filter: SetlistListFilter): Promise<SetlistRecord[]> {
    const rows = await this.prisma.setlist.findMany({
      where: buildListWhere(filter),
      include: setlistInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => toSetlistRecord(row as SetlistRow));
  }

  async listFollowedBy(teamId: string): Promise<SetlistRecord[]> {
    const rows = await this.prisma.setlist.findMany({
      where: { follows: { some: { teamId } } },
      include: setlistInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => toSetlistRecord(row as SetlistRow));
  }

  async create(input: NewSetlist): Promise<SetlistRecord> {
    await this.prisma.setlist.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        ownerTeamId: input.ownerTeamId,
        ownerUserId: null,
        createdByUserId: input.createdByUserId ?? null,
        title: input.title,
        eventType: input.eventType ?? null,
        eventAt: input.eventAt ? new Date(input.eventAt) : null,
        status: input.status,
        visibility: input.visibility,
        notes: input.notes ?? null,
        version: 1,
      },
    });
    return (await this.findById(input.id))!;
  }

  async updateMeta(
    id: string,
    expectedVersion: number,
    patch: SetlistMetaPatch,
  ): Promise<SetlistRecord> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.setlist.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          version: { increment: 1 },
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.eventType !== undefined ? { eventType: patch.eventType } : {}),
          ...(patch.eventAt !== undefined
            ? { eventAt: patch.eventAt ? new Date(patch.eventAt) : null }
            : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
        },
      });
      if (updated.count === 0) {
        throw await this.versionConflict(tx as PrismaClient, id, expectedVersion);
      }
      return (await new PrismaSetlistRepository(tx as PrismaClient).findById(id))!;
    });
  }

  async replaceItems(
    id: string,
    expectedVersion: number,
    items: NewSetlistItem[],
    existingItemIds: ReadonlySet<string> = new Set(),
  ): Promise<SetlistRecord> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.setlist.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: { version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw await this.versionConflict(tx as PrismaClient, id, expectedVersion);
      }
      await tx.setlistItem.deleteMany({ where: { setlistId: id } });
      if (items.length > 0) {
        await tx.setlistItem.createMany({
          data: items.map((item, position) => {
            if (item.kind === "note") {
              return {
                id: item.id,
                setlistId: id,
                position,
                kind: "note",
                text: item.text,
                notes: item.notes ?? null,
              };
            }
            return {
              id: item.id,
              setlistId: id,
              position,
              kind: "song",
              songId: item.songId,
              chartId: item.chartId,
              selectedKey: item.selectedKey,
              notes: item.notes ?? null,
            };
          }),
        });
      }
      void existingItemIds;
      return (await new PrismaSetlistRepository(tx as PrismaClient).findById(id))!;
    });
  }

  async softDelete(id: string, expectedVersion: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.setlist.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: { version: { increment: 1 }, deletedAt: new Date() },
      });
      if (updated.count === 0) {
        throw await this.versionConflict(tx as PrismaClient, id, expectedVersion);
      }
    });
  }

  async follow(setlistId: string, teamId: string): Promise<void> {
    await this.prisma.setlistFollow.upsert({
      where: { setlistId_teamId: { setlistId, teamId } },
      create: { setlistId, teamId },
      update: {},
    });
  }

  async unfollow(setlistId: string, teamId: string): Promise<void> {
    await this.prisma.setlistFollow.deleteMany({
      where: { setlistId, teamId },
    });
  }

  async applyClonePlan(plan: ClonePlan): Promise<SetlistRecord> {
    return this.prisma.$transaction(async (tx) => {
      for (const entry of plan.songsToCreate) {
        const data = toPrismaSongCreate(entry.song, plan.setlist.organizationId);
        await tx.song.create({
          data: { ...data, sourceOrganizationId: entry.sourceOrganizationId },
        });
      }

      for (const entry of plan.chartsToCreate) {
        const data = toPrismaChartCreate(entry.chart, plan.setlist.organizationId);
        await tx.chordChart.create({
          data: { ...data, sourceOrganizationId: entry.sourceOrganizationId },
        });
      }

      await tx.setlist.create({
        data: {
          id: plan.setlist.id,
          organizationId: plan.setlist.organizationId,
          ownerTeamId: plan.setlist.ownerTeamId,
          ownerUserId: null,
          title: plan.setlist.title,
          eventType: plan.setlist.eventType ?? null,
          eventAt: null,
          status: plan.setlist.status,
          visibility: plan.setlist.visibility,
          notes: plan.setlist.notes ?? null,
          version: 1,
        },
      });

      if (plan.items.length > 0) {
        await tx.setlistItem.createMany({
          data: plan.items.map((item, position) => {
            if (item.kind === "note") {
              return {
                id: item.id,
                setlistId: plan.setlist.id,
                position,
                kind: "note",
                text: item.text,
                notes: item.notes ?? null,
              };
            }
            return {
              id: item.id,
              setlistId: plan.setlist.id,
              position,
              kind: "song",
              songId: item.songId,
              chartId: item.chartId,
              selectedKey: item.selectedKey,
              notes: item.notes ?? null,
            };
          }),
        });
      }

      return (await new PrismaSetlistRepository(tx as PrismaClient).findById(plan.setlist.id))!;
    });
  }

  private async versionConflict(
    prisma: PrismaClient,
    id: string,
    expectedVersion: number,
  ): Promise<SetlistVersionConflictError> {
    const current = await prisma.setlist.findFirst({ where: { id }, select: { version: true } });
    return new SetlistVersionConflictError(current?.version ?? expectedVersion);
  }
}

/** Preserva ids de item já pertencentes ao setlist ao montar a lista para replaceItems. */
export function mergeReplaceItemIds(
  incoming: NewSetlistItem[],
  existingIds: ReadonlySet<string>,
  newId: () => string,
): NewSetlistItem[] {
  return incoming.map((item) => {
    const id = existingIds.has(item.id) ? item.id : newId();
    return { ...item, id };
  });
}
