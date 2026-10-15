import type { PrismaClient } from "@prisma/client";

export type PublicSongSummary = {
  id: string;
  title: string;
  artist: string | null;
};

export type PublicLyrics = {
  title: string;
  artist: string | null;
  imported: { originUrl: string } | null;
  sections: { label: string; lines: string[] }[];
};

type ChartSection = {
  label?: string;
  lines?: { text?: string; chords?: unknown }[];
};

export function toPublicLyrics(input: {
  title: string;
  artist: string | null;
  originUrl: string | null;
  origin: unknown;
  sections: unknown;
}): PublicLyrics {
  const sectionsRaw = Array.isArray(input.sections) ? (input.sections as ChartSection[]) : [];
  const sections = sectionsRaw.map((section) => ({
    label: section.label ?? "",
    lines: (section.lines ?? [])
      .map((line) => String(line.text ?? "").trim())
      .filter(Boolean),
  }));

  const imported =
    input.originUrl && input.origin
      ? { originUrl: input.originUrl }
      : null;

  return {
    title: input.title,
    artist: input.artist,
    imported,
    sections,
  };
}

export async function listPublicSongs(prisma: PrismaClient): Promise<PublicSongSummary[]> {
  const songs = await prisma.song.findMany({
    where: {
      publicLyrics: true,
      charts: { some: { format: "lyrics" } },
    },
    select: { id: true, title: true, artist: true },
    orderBy: { title: "asc" },
  });
  return songs;
}

export async function getPublicLyrics(
  prisma: PrismaClient,
  songId: string,
): Promise<PublicLyrics | undefined> {
  const song = await prisma.song.findFirst({
    where: { id: songId, publicLyrics: true },
    include: {
      charts: {
        where: { format: "lyrics" },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!song || song.charts.length === 0) {
    return undefined;
  }
  const chart = song.charts[0]!;
  return toPublicLyrics({
    title: song.title,
    artist: song.artist,
    originUrl: chart.originUrl,
    origin: chart.origin,
    sections: chart.sections,
  });
}
