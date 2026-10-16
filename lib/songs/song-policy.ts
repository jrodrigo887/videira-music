import type { UserActor } from "@/lib/auth/actor";
import { hasCapability } from "@/lib/auth/actor";

type SongAuthorship = {
  organizationId: string;
  createdByUserId: string | null;
  deletedAt?: Date | null;
};

type ChartAuthorship = {
  organizationId: string;
  createdByUserId: string | null;
};

export function canEditChartContent(
  actor: UserActor,
  chart: ChartAuthorship,
  song: Pick<SongAuthorship, "deletedAt">,
): boolean {
  if (song.deletedAt) {
    return false;
  }
  if (actor.organizationId !== chart.organizationId) {
    return false;
  }
  if (hasCapability(actor, "music:write", chart.organizationId)) {
    return true;
  }
  return chart.createdByUserId === actor.userId;
}

export function canEditSongContent(actor: UserActor, song: SongAuthorship): boolean {
  if (song.deletedAt) {
    return false;
  }
  if (actor.organizationId !== song.organizationId) {
    return false;
  }
  if (hasCapability(actor, "music:write", song.organizationId)) {
    return true;
  }
  return song.createdByUserId === actor.userId;
}

export function canChangePublicLyrics(actor: UserActor, song: SongAuthorship): boolean {
  if (song.deletedAt) {
    return false;
  }
  return hasCapability(actor, "music:write", song.organizationId);
}

export function canDeleteSong(actor: UserActor, organizationId: string): boolean {
  return hasCapability(actor, "music:delete", organizationId);
}
