import type { PrismaClient } from "@prisma/client";

import type { Actor, UserActor } from "@/lib/auth/actor";
import { generateInviteCode, hashInviteCode } from "@/lib/invites/invite-token";
import { toPublicLyrics, type PublicLyrics } from "@/lib/public-lyrics/public-lyrics";

import { canPerform, type SetlistAccess } from "./setlist-policy";

export class ShareLinkServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly userMessage: string;

  constructor(status: number, code: string, userMessage: string = code) {
    super(code);
    this.name = "ShareLinkServiceError";
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
  }
}

function shareError(status: number, code: string, userMessage?: string): ShareLinkServiceError {
  return new ShareLinkServiceError(status, code, userMessage ?? code);
}

export function isShareLinkServiceError(error: unknown): error is ShareLinkServiceError {
  return error instanceof ShareLinkServiceError;
}

export type SharedSetlistSongItem =
  | {
      kind: "song";
      title: string;
      artist: string | null;
      unavailable: true;
    }
  | (PublicLyrics & { kind: "song"; unavailable?: false });

export type SharedSetlist = {
  title: string;
  items: SharedSetlistSongItem[];
};

function assertUserActor(actor: Actor): UserActor {
  if (actor.kind !== "user") {
    throw shareError(403, "FORBIDDEN");
  }
  return actor;
}

function toSetlistAccess(row: {
  organizationId: string;
  ownerTeamId: string | null;
  createdByUserId: string | null;
  status: string;
  visibility: string;
  deletedAt: Date | null;
  follows: { teamId: string }[];
}): SetlistAccess {
  return {
    organizationId: row.organizationId,
    ownerTeamId: row.ownerTeamId,
    createdByUserId: row.createdByUserId,
    status: row.status,
    visibility: row.visibility,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    followerTeamIds: row.follows.map((follow) => follow.teamId),
  };
}

function assertCanEditSetlist(actor: UserActor, access: SetlistAccess): void {
  if (!canPerform(actor, "edit", { type: "setlist", setlist: access })) {
    throw shareError(403, "FORBIDDEN");
  }
}

function assertShareableSetlist(row: {
  status: string;
  deletedAt: Date | null;
}): void {
  if (row.deletedAt || row.status !== "published") {
    throw shareError(409, "SETLIST_NOT_SHAREABLE");
  }
}

async function loadSetlistForShare(
  prisma: PrismaClient,
  setlistId: string,
  organizationId: string,
) {
  const row = await prisma.setlist.findFirst({
    where: { id: setlistId, organizationId, deletedAt: null },
    include: { follows: { select: { teamId: true } } },
  });
  if (!row) {
    throw shareError(404, "NOT_FOUND");
  }
  return row;
}

export async function createShareLink(
  prisma: PrismaClient,
  actor: Actor,
  setlistId: string,
): Promise<{ code: string }> {
  const user = assertUserActor(actor);
  const setlist = await loadSetlistForShare(prisma, setlistId, user.organizationId);
  const access = toSetlistAccess(setlist);
  assertCanEditSetlist(user, access);
  assertShareableSetlist(setlist);

  const { code, hash } = generateInviteCode();
  await prisma.setlistShareLink.create({
    data: {
      setlistId,
      tokenHash: hash,
      createdByUserId: user.userId,
    },
  });
  return { code };
}

export async function revokeShareLink(
  prisma: PrismaClient,
  actor: Actor,
  setlistId: string,
  linkId: string,
): Promise<void> {
  const user = assertUserActor(actor);
  const setlist = await loadSetlistForShare(prisma, setlistId, user.organizationId);
  const access = toSetlistAccess(setlist);
  assertCanEditSetlist(user, access);

  const link = await prisma.setlistShareLink.findFirst({
    where: { id: linkId, setlistId },
  });
  if (!link || link.revokedAt) {
    throw shareError(404, "NOT_FOUND");
  }

  await prisma.setlistShareLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });
}

export async function readSharedLyrics(
  prisma: PrismaClient,
  code: string,
): Promise<SharedSetlist | undefined> {
  const tokenHash = hashInviteCode(code);
  const link = await prisma.setlistShareLink.findFirst({
    where: { tokenHash, revokedAt: null },
    include: {
      setlist: {
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              song: {
                select: { title: true, artist: true, deletedAt: true },
              },
              chart: {
                select: {
                  origin: true,
                  originUrl: true,
                  sections: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!link) {
    return undefined;
  }

  const setlist = link.setlist;
  if (setlist.deletedAt || setlist.status !== "published") {
    return undefined;
  }

  const items: SharedSetlistSongItem[] = [];
  for (const item of setlist.items) {
    if (item.kind !== "song" || !item.song) {
      continue;
    }
    if (item.song.deletedAt) {
      items.push({
        kind: "song",
        title: item.song.title,
        artist: item.song.artist,
        unavailable: true,
      });
      continue;
    }
    if (!item.chart) {
      continue;
    }
    const lyrics = toPublicLyrics({
      title: item.song.title,
      artist: item.song.artist,
      originUrl: item.chart.originUrl,
      origin: item.chart.origin,
      sections: item.chart.sections,
    });
    items.push({ kind: "song", ...lyrics });
  }

  return {
    title: setlist.title,
    items,
  };
}
