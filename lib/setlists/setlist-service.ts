import type { PrismaClient } from "@prisma/client";

import type { Actor } from "@/lib/auth/actor";
import { isTransposableKey } from "@/lib/chords/transpose-chord";
import { canonicalizeOriginUrl } from "@/lib/persistence/origin-url";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import { PrismaMusicRepository } from "@/lib/persistence/prisma-music-repository";
import { toDomainChart, toDomainSong } from "@/lib/persistence/persistence-utils";
import type { ChordChart } from "@/types/music";
import type {
  CloneSetlistInput,
  CreateSetlistInput,
  DeleteSetlistInput,
  FollowedEntry,
  FollowSetlistInput,
  ReplaceSetlistItemsInput,
  Setlist,
  SetlistItem,
  SetlistStatus,
  SetlistSummary,
  SetlistVisibility,
  UpdateSetlistInput,
} from "@/types/setlist";
import type { WorshipTeam } from "@/types/identity";

import { buildClonePlan } from "./clone-plan";
import { mergeReplaceItemIds, PrismaSetlistRepository } from "./prisma-setlist-repository";
import { canPerform, type SetlistAccess } from "./setlist-policy";
import type { NewSetlistItem, SetlistRecord, SetlistRepository } from "./setlist-repository";
import { SetlistVersionConflictError } from "./setlist-repository";
import { throwSetlistError } from "./setlist-errors";
import type { WorshipTeamRepository } from "@/lib/worship-teams/worship-team-repository";

export type SetlistTab = "team" | "others" | "organization" | "following";

export type SetlistView = Setlist;

const STATUS_TRANSITIONS: Record<SetlistStatus, readonly SetlistStatus[]> = {
  draft: ["published"],
  published: ["archived"],
  archived: ["published"],
};

export type SetlistServiceDependencies = {
  organizationId: string;
  setlistRepository: SetlistRepository;
  teamRepository: WorshipTeamRepository;
  musicRepository: MusicRepository;
  prisma: PrismaClient;
  newId: () => string;
};

export type SetlistService = ReturnType<typeof createSetlistService>;

function toAccess(record: SetlistRecord): SetlistAccess {
  return {
    organizationId: record.organizationId,
    ownerTeamId: record.ownerTeamId,
    status: record.status,
    visibility: record.visibility,
    deletedAt: record.deletedAt ?? null,
    followerTeamIds: record.followerTeamIds,
  };
}

function permissionsFor(actor: Actor, record: SetlistRecord) {
  const access = toAccess(record);
  return {
    edit: canPerform(actor, "edit", { type: "setlist", setlist: access }),
    changeStatus: canPerform(actor, "changeStatus", { type: "setlist", setlist: access }),
    delete: canPerform(actor, "delete", { type: "setlist", setlist: access }),
  };
}

function toSetlistItem(record: SetlistRecord["items"][number]): SetlistItem {
  if (record.kind === "note") {
    return {
      id: record.id,
      kind: "note",
      position: record.position,
      text: record.text,
      ...(record.notes ? { notes: record.notes } : {}),
    };
  }
  return {
    id: record.id,
    kind: "song",
    position: record.position,
    songId: record.songId,
    chartId: record.chartId,
    selectedKey: record.selectedKey,
    ...(record.notes ? { notes: record.notes } : {}),
    song: {
      title: record.songTitle,
      ...(record.songArtist ? { artist: record.songArtist } : {}),
    },
    chart: {
      key: record.chartKey,
      ...(record.originUrl ? { originUrl: record.originUrl } : {}),
      imported: record.imported,
    },
  };
}

function toSetlistView(actor: Actor, record: SetlistRecord): SetlistView {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerTeamId: record.ownerTeamId,
    title: record.title,
    ...(record.eventType ? { eventType: record.eventType } : {}),
    ...(record.eventAt ? { eventAt: record.eventAt } : {}),
    status: record.status,
    visibility: record.visibility,
    ...(record.notes ? { notes: record.notes } : {}),
    version: record.version,
    items: record.items.map(toSetlistItem),
    followerCount: record.followerTeamIds.length,
    permissions: permissionsFor(actor, record),
  };
}

function toSetlistSummary(actor: Actor, record: SetlistRecord): SetlistSummary {
  const view = toSetlistView(actor, record);
  const { items: _items, notes: _notes, ...summary } = view;
  void _items;
  void _notes;
  return summary;
}

function assertNotFound(): never {
  throw throwSetlistError(404, "SETLIST_NOT_FOUND");
}

function assertReadable(actor: Actor, record: SetlistRecord | undefined): SetlistRecord {
  if (!record || record.deletedAt) {
    assertNotFound();
  }
  if (!canPerform(actor, "read", { type: "setlist", setlist: toAccess(record) })) {
    assertNotFound();
  }
  return record;
}

function assertOrganizationVisibility(
  ownerTeamId: string | null,
  visibility: SetlistVisibility,
): void {
  if (ownerTeamId === null && visibility === "team") {
    throw throwSetlistError(400, "INVALID_VISIBILITY", {
      issues: [{ path: "visibility", message: "Visibilidade inválida para setlist da igreja." }],
    });
  }
}

function followerMemberActor(organizationId: string, teamId: string): Actor {
  return {
    kind: "user",
    userId: "follower-check",
    organizationId,
    role: "member",
    teams: [{ teamId, role: "member" }],
  };
}

function countAffectedFollowers(
  record: SetlistRecord,
  patch: { visibility?: SetlistVisibility; deleted?: boolean },
): number {
  if (record.followerTeamIds.length === 0) {
    return 0;
  }

  const nextAccess: SetlistAccess = {
    organizationId: record.organizationId,
    ownerTeamId: record.ownerTeamId,
    status: record.status,
    visibility: patch.visibility ?? record.visibility,
    deletedAt: patch.deleted ? new Date().toISOString() : null,
    followerTeamIds: record.followerTeamIds,
  };

  return record.followerTeamIds.filter((teamId) => {
    const actor = followerMemberActor(record.organizationId, teamId);
    return !canPerform(actor, "read", { type: "setlist", setlist: nextAccess });
  }).length;
}

function shouldIncludeInBrowseTab(
  actor: Actor,
  record: SetlistRecord,
  tab: Exclude<SetlistTab, "following">,
): boolean {
  if (record.deletedAt) {
    return false;
  }
  const access = toAccess(record);
  if (!canPerform(actor, "read", { type: "setlist", setlist: access })) {
    return false;
  }
  const canEdit = canPerform(actor, "edit", { type: "setlist", setlist: access });
  if (record.status === "draft" && !canEdit) {
    return false;
  }
  if (record.status === "archived") {
    return false;
  }
  return true;
}

export function createSetlistService(dependencies: SetlistServiceDependencies) {
  const {
    organizationId,
    setlistRepository,
    teamRepository,
    musicRepository,
    prisma,
    newId,
  } = dependencies;

  async function assertTeamActive(teamId: string): Promise<void> {
    const team = await teamRepository.findById(teamId);
    if (!team || team.organizationId !== organizationId || team.archivedAt) {
      throw throwSetlistError(409, "TEAM_ARCHIVED");
    }
  }

  async function findChart(chartId: string) {
    return prisma.chordChart.findFirst({
      where: { id: chartId },
      select: { id: true, songId: true, organizationId: true, key: true },
    });
  }

  return {
    async listTab(
      actor: Actor,
      input: { team: WorshipTeam | null; tab: SetlistTab },
    ): Promise<SetlistSummary[] | FollowedEntry[]> {
      const { team, tab } = input;

      if (tab === "following") {
        if (!team) {
          return [];
        }
        const followed = await setlistRepository.listFollowedBy(team.id);
        return followed.map((record): FollowedEntry => {
          if (
            record.deletedAt ||
            !canPerform(actor, "read", { type: "setlist", setlist: toAccess(record) })
          ) {
            return { setlistId: record.id, available: false };
          }
          return {
            setlistId: record.id,
            available: true,
            setlist: toSetlistSummary(actor, record),
          };
        });
      }

      const records = await setlistRepository.list({
        organizationId,
        includeArchived: false,
      });

      const filtered = records.filter((record) => {
        if (!shouldIncludeInBrowseTab(actor, record, tab)) {
          return false;
        }
        if (tab === "team") {
          return team !== null && record.ownerTeamId === team.id;
        }
        if (tab === "others") {
          return record.ownerTeamId !== null && record.ownerTeamId !== team?.id;
        }
        return record.ownerTeamId === null;
      });

      return filtered.map((record) => toSetlistSummary(actor, record));
    },

    async getReadable(actor: Actor, id: string): Promise<SetlistView> {
      const record = await setlistRepository.findById(id);
      return toSetlistView(actor, assertReadable(actor, record));
    },

    async create(actor: Actor, input: CreateSetlistInput): Promise<SetlistView> {
      if (actor.kind === "anonymous") {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      let ownerTeamId: string | null = input.ownerTeamId ?? null;
      if (input.owner === "organization") {
        ownerTeamId = null;
      }

      if (ownerTeamId === null) {
        if (
          !canPerform(actor, "create", {
            type: "destination",
            organizationId,
            teamId: null,
          })
        ) {
          throw throwSetlistError(403, "FORBIDDEN");
        }
      } else {
        if (
          !canPerform(actor, "create", {
            type: "destination",
            organizationId,
            teamId: ownerTeamId,
          })
        ) {
          throw throwSetlistError(403, "FORBIDDEN");
        }
        await assertTeamActive(ownerTeamId);
      }

      const visibility: SetlistVisibility =
        input.visibility ?? (ownerTeamId === null ? "organization" : "team");
      assertOrganizationVisibility(ownerTeamId, visibility);

      const created = await setlistRepository.create({
        id: newId(),
        organizationId,
        ownerTeamId,
        title: input.title,
        status: "draft",
        visibility,
        ...(input.eventType ? { eventType: input.eventType } : {}),
        ...(input.eventAt ? { eventAt: input.eventAt } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      });

      return toSetlistView(actor, created);
    },

    async updateMeta(actor: Actor, id: string, input: UpdateSetlistInput): Promise<SetlistView> {
      const record = await setlistRepository.findById(id);
      if (!record || record.deletedAt) {
        assertNotFound();
      }
      const access = toAccess(record);
      if (!canPerform(actor, "edit", { type: "setlist", setlist: access })) {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      if (input.visibility !== undefined) {
        assertOrganizationVisibility(record.ownerTeamId, input.visibility);
      }

      if (input.status !== undefined) {
        if (!canPerform(actor, "changeStatus", { type: "setlist", setlist: access })) {
          throw throwSetlistError(403, "FORBIDDEN");
        }
        const allowed = STATUS_TRANSITIONS[record.status];
        if (!allowed.includes(input.status)) {
          throw throwSetlistError(400, "INVALID_STATUS_TRANSITION");
        }
      }

      const visibilityChanging =
        input.visibility !== undefined && input.visibility !== record.visibility;
      if (visibilityChanging) {
        const affected = countAffectedFollowers(record, {
          visibility: input.visibility,
          deleted: false,
        });
        if (affected > 0 && !input.confirmFollowersImpact) {
          throw throwSetlistError(409, "SETLIST_HAS_FOLLOWERS", { followerCount: affected });
        }
      }

      try {
        const updated = await setlistRepository.updateMeta(id, input.expectedVersion, {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
          ...(input.eventAt !== undefined ? { eventAt: input.eventAt } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        });
        return toSetlistView(actor, updated);
      } catch (error) {
        if (error instanceof SetlistVersionConflictError) {
          throw throwSetlistError(409, "SETLIST_VERSION_CONFLICT", { version: error.currentVersion });
        }
        throw error;
      }
    },

    async replaceItems(
      actor: Actor,
      id: string,
      input: ReplaceSetlistItemsInput,
    ): Promise<SetlistView> {
      const record = await setlistRepository.findById(id);
      if (!record || record.deletedAt) {
        assertNotFound();
      }
      if (!canPerform(actor, "edit", { type: "setlist", setlist: toAccess(record) })) {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      const existingIds = new Set(record.items.map((item) => item.id));
      const seenSongChart = new Set<string>();

      const validatedItems: NewSetlistItem[] = [];
      for (const item of input.items) {
        if (item.kind === "note") {
          validatedItems.push({
            id: item.id ?? "",
            kind: "note",
            text: item.text,
            ...(item.notes ? { notes: item.notes } : {}),
          });
          continue;
        }

        if (!item.chartId) {
          throw throwSetlistError(400, "INVALID_ITEM", {
            issues: [{ path: "items", message: "Cifra obrigatória." }],
          });
        }

        const chart = await findChart(item.chartId);
        if (!chart || chart.songId !== item.songId || chart.organizationId !== organizationId) {
          throw throwSetlistError(400, "INVALID_ITEM", {
            issues: [{ path: "items", message: "Cifra ou música inválida." }],
          });
        }

        const duplicateKey = `${item.songId}:${item.chartId}`;
        if (seenSongChart.has(duplicateKey)) {
          throw throwSetlistError(400, "INVALID_ITEM", {
            issues: [{ path: "items", message: "Item duplicado." }],
          });
        }
        seenSongChart.add(duplicateKey);

        const selectedKey = item.selectedKey ?? chart.key;
        if (!isTransposableKey(selectedKey)) {
          throw throwSetlistError(400, "INVALID_KEY", {
            issues: [{ path: "selectedKey", message: "Tom inválido." }],
          });
        }

        validatedItems.push({
          id: item.id ?? "",
          kind: "song",
          songId: item.songId,
          chartId: item.chartId,
          selectedKey,
          ...(item.notes ? { notes: item.notes } : {}),
        });
      }

      const itemsToWrite = mergeReplaceItemIds(validatedItems, existingIds, newId);

      try {
        const updated = await setlistRepository.replaceItems(
          id,
          input.expectedVersion,
          itemsToWrite,
          existingIds,
        );
        return toSetlistView(actor, updated);
      } catch (error) {
        if (error instanceof SetlistVersionConflictError) {
          throw throwSetlistError(409, "SETLIST_VERSION_CONFLICT", { version: error.currentVersion });
        }
        throw error;
      }
    },

    async delete(actor: Actor, id: string, input: DeleteSetlistInput): Promise<void> {
      const record = await setlistRepository.findById(id);
      if (!record || record.deletedAt) {
        assertNotFound();
      }
      if (!canPerform(actor, "delete", { type: "setlist", setlist: toAccess(record) })) {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      const affected = countAffectedFollowers(record, { deleted: true });
      if (affected > 0 && !input.confirmFollowersImpact) {
        throw throwSetlistError(409, "SETLIST_HAS_FOLLOWERS", { followerCount: affected });
      }

      try {
        await setlistRepository.softDelete(id, input.expectedVersion);
      } catch (error) {
        if (error instanceof SetlistVersionConflictError) {
          throw throwSetlistError(409, "SETLIST_VERSION_CONFLICT", { version: error.currentVersion });
        }
        throw error;
      }
    },

    async follow(actor: Actor, id: string, input: FollowSetlistInput): Promise<void> {
      const record = await setlistRepository.findById(id);
      if (!record || record.deletedAt) {
        assertNotFound();
      }

      if (
        !canPerform(actor, "follow", {
          type: "destination",
          organizationId,
          teamId: input.teamId,
        })
      ) {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      if (record.status === "draft") {
        throw throwSetlistError(409, "CANNOT_FOLLOW");
      }

      if (record.ownerTeamId === input.teamId) {
        throw throwSetlistError(409, "CANNOT_FOLLOW");
      }

      const followerActor = followerMemberActor(organizationId, input.teamId);
      if (!canPerform(followerActor, "read", { type: "setlist", setlist: toAccess(record) })) {
        throw throwSetlistError(409, "CANNOT_FOLLOW");
      }

      await setlistRepository.follow(id, input.teamId);
    },

    async unfollow(actor: Actor, id: string, input: FollowSetlistInput): Promise<void> {
      if (
        !canPerform(actor, "follow", {
          type: "destination",
          organizationId,
          teamId: input.teamId,
        })
      ) {
        throw throwSetlistError(403, "FORBIDDEN");
      }
      await setlistRepository.unfollow(id, input.teamId);
    },

    async clone(actor: Actor, id: string, input: CloneSetlistInput): Promise<SetlistView> {
      const source = await setlistRepository.findById(id);
      if (!source || source.deletedAt) {
        assertNotFound();
      }
      if (source.status === "draft") {
        throw throwSetlistError(409, "CANNOT_CLONE");
      }
      if (!canPerform(actor, "read", { type: "setlist", setlist: toAccess(source) })) {
        throw throwSetlistError(409, "CANNOT_CLONE");
      }

      let targetTeamId: string | null = null;
      if ("targetTeamId" in input) {
        targetTeamId = input.targetTeamId;
        await assertTeamActive(targetTeamId);
      }

      if (
        !canPerform(actor, "clone", {
          type: "destination",
          organizationId,
          teamId: targetTeamId,
        })
      ) {
        throw throwSetlistError(403, "FORBIDDEN");
      }

      const songIds = [
        ...new Set(
          source.items
            .filter((item): item is Extract<typeof item, { kind: "song" }> => item.kind === "song")
            .map((item) => item.songId),
        ),
      ];
      const chartIds = [
        ...new Set(
          source.items
            .filter((item): item is Extract<typeof item, { kind: "song" }> => item.kind === "song")
            .map((item) => item.chartId),
        ),
      ];

      const songRows = await prisma.song.findMany({ where: { id: { in: songIds } } });
      const chartRows = await prisma.chordChart.findMany({ where: { id: { in: chartIds } } });
      const sourceCatalog = {
        songs: songRows.map(toDomainSong),
        charts: chartRows.map((row) => {
          const chart = toDomainChart(row);
          if (!chart.origin?.url && row.originUrl) {
            return {
              ...chart,
              origin: { kind: "url", url: row.originUrl },
            } satisfies ChordChart;
          }
          return chart;
        }),
      };

      const targetCharts = await prisma.chordChart.findMany({
        where: { organizationId, originUrl: { not: null } },
        select: { id: true, songId: true, originUrl: true },
      });
      const existingTargetChartsByOriginUrl = new Map<
        string,
        { chartId: string; songId: string }
      >();
      for (const chart of targetCharts) {
        if (chart.originUrl) {
          existingTargetChartsByOriginUrl.set(canonicalizeOriginUrl(chart.originUrl), {
            chartId: chart.id,
            songId: chart.songId,
          });
        }
      }

      const plan = buildClonePlan({
        source,
        sourceCatalog,
        target: { organizationId, ownerTeamId: targetTeamId },
        existingTargetChartsByOriginUrl,
        newId,
      });

      try {
        const cloned = await setlistRepository.applyClonePlan(plan);
        return toSetlistView(actor, cloned);
      } catch {
        throw throwSetlistError(500, "PERSISTENCE_FAILED");
      }
    },
  };
}

export function createSetlistServiceFromPrisma(
  prisma: PrismaClient,
  organizationId: string,
  teamRepository: WorshipTeamRepository,
  newId: () => string = () => crypto.randomUUID(),
) {
  return createSetlistService({
    organizationId,
    setlistRepository: new PrismaSetlistRepository(prisma),
    teamRepository,
    musicRepository: new PrismaMusicRepository(prisma, { organizationId }),
    prisma,
    newId,
  });
}
