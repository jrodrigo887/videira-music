import type { PrismaClient } from "@prisma/client";

import type { UserActor } from "@/lib/auth/actor";
import { canDeleteSong } from "@/lib/songs/song-policy";

export class SongTrashServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "SongTrashServiceError";
    this.status = status;
    this.code = code;
  }
}

function trashError(status: number, code: string): SongTrashServiceError {
  return new SongTrashServiceError(status, code);
}

export function isSongTrashServiceError(error: unknown): error is SongTrashServiceError {
  return error instanceof SongTrashServiceError;
}

async function writeAudit(
  prisma: PrismaClient,
  entry: {
    actorUserId: string;
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

export async function deleteSong(
  prisma: PrismaClient,
  actor: UserActor,
  songId: string,
): Promise<void> {
  if (!canDeleteSong(actor, actor.organizationId)) {
    throw trashError(403, "FORBIDDEN");
  }

  const row = await prisma.song.findFirst({
    where: { id: songId, organizationId: actor.organizationId },
  });
  if (!row || row.deletedAt) {
    throw trashError(404, "NOT_FOUND");
  }

  await prisma.song.update({
    where: { id: songId },
    data: { deletedAt: new Date() },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "song.delete",
    details: { songId },
  });
}

export async function restoreSong(
  prisma: PrismaClient,
  actor: UserActor,
  songId: string,
): Promise<void> {
  if (!canDeleteSong(actor, actor.organizationId)) {
    throw trashError(403, "FORBIDDEN");
  }

  const row = await prisma.song.findFirst({
    where: { id: songId, organizationId: actor.organizationId },
  });
  if (!row) {
    throw trashError(404, "NOT_FOUND");
  }
  if (!row.deletedAt) {
    throw trashError(409, "SONG_NOT_DELETED");
  }

  await prisma.song.update({
    where: { id: songId },
    data: { deletedAt: null },
  });

  await writeAudit(prisma, {
    actorUserId: actor.userId,
    action: "song.restore",
    details: { songId },
  });
}

export type TrashedSongSummary = {
  id: string;
  title: string;
  artist: string | null;
  deletedAt: string;
};

export async function listTrashedSongs(
  prisma: PrismaClient,
  organizationId: string,
): Promise<TrashedSongSummary[]> {
  const rows = await prisma.song.findMany({
    where: { organizationId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, title: true, artist: true, deletedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    deletedAt: row.deletedAt!.toISOString(),
  }));
}
