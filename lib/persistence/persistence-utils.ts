import type { ChordChart, Song } from "@/types/music";
import type { ChordChart as PrismaChart, Song as PrismaSong } from "@prisma/client";

import { buildSongSearchText } from "./search-text";
import { canonicalizeOriginUrl } from "./origin-url";

export { canonicalizeOriginUrl };

export function resolveOriginUrl(chart: ChordChart): string | undefined {
  if (!chart.origin?.url) {
    return undefined;
  }
  try {
    return canonicalizeOriginUrl(chart.origin.url);
  } catch {
    return undefined;
  }
}

export function toDomainSong(row: PrismaSong): Song {
  const alternateKeys = row.alternateKeys as string[];
  return {
    id: row.id,
    title: row.title,
    label: row.label,
    ...(row.artist ? { artist: row.artist } : {}),
    ...(row.genre ? { genre: row.genre } : {}),
    ...(row.defaultKey ? { defaultKey: row.defaultKey } : {}),
    alternateKeys: Array.isArray(alternateKeys) ? alternateKeys : [],
    ...(row.notes ? { notes: row.notes } : {}),
    meta: row.meta,
    publicLyrics: row.publicLyrics,
  };
}

export function toDomainChart(row: PrismaChart): ChordChart {
  const sections = row.sections as ChordChart["sections"];
  const origin = row.origin as ChordChart["origin"] | null;
  return {
    id: row.id,
    songId: row.songId,
    ...(row.title ? { title: row.title } : {}),
    format: row.format as ChordChart["format"],
    key: row.key,
    timeSignature: row.timeSignature,
    ...(row.tempo != null ? { tempo: row.tempo } : {}),
    ...(row.capo != null ? { capo: row.capo } : {}),
    sections: Array.isArray(sections) ? sections : [],
    ...(row.source ? { source: row.source } : {}),
    ...(origin ? { origin } : {}),
  };
}

export function toPrismaSongCreate(song: Song, organizationId: string) {
  return {
    id: song.id,
    organizationId,
    title: song.title,
    label: song.label,
    artist: song.artist ?? null,
    genre: song.genre ?? null,
    defaultKey: song.defaultKey ?? null,
    alternateKeys: song.alternateKeys,
    notes: song.notes ?? null,
    meta: song.meta,
    searchText: buildSongSearchText(song),
    publicLyrics: song.publicLyrics ?? false,
  };
}

export function toPrismaChartCreate(chart: ChordChart, organizationId: string) {
  return {
    id: chart.id,
    organizationId,
    songId: chart.songId,
    title: chart.title ?? null,
    format: chart.format,
    key: chart.key,
    timeSignature: chart.timeSignature,
    tempo: chart.tempo ?? null,
    capo: chart.capo ?? null,
    sections: chart.sections,
    source: chart.source ?? null,
    origin: chart.origin ?? undefined,
    originUrl: resolveOriginUrl(chart) ?? null,
    schemaVersion: 1,
  };
}
