import { canonicalizeOriginUrl } from "@/lib/persistence/origin-url";
import type { ChordChart, Song } from "@/types/music";
import type {
  ClonePlan,
  ClonePlanItemCreate,
  SetlistRecord,
} from "@/lib/setlists/setlist-repository";

export type BuildClonePlanInput = {
  source: SetlistRecord;
  sourceCatalog: { songs: Song[]; charts: ChordChart[] };
  target: { organizationId: string; ownerTeamId: string | null };
  existingTargetChartsByOriginUrl: Map<string, { chartId: string; songId: string }>;
  newId: () => string;
};

export function buildClonePlan(input: BuildClonePlanInput): ClonePlan {
  const { source, sourceCatalog, target, existingTargetChartsByOriginUrl, newId } = input;
  const sameOrganization = source.organizationId === target.organizationId;

  const songsById = new Map(sourceCatalog.songs.map((song) => [song.id, song]));
  const chartsById = new Map(sourceCatalog.charts.map((chart) => [chart.id, chart]));

  const songIdMap = new Map<string, string>();
  const chartIdMap = new Map<string, string>();
  const songsToCreate: ClonePlan["songsToCreate"] = [];
  const chartsToCreate: ClonePlan["chartsToCreate"] = [];

  function resolveSong(sourceSongId: string): string {
    const existing = songIdMap.get(sourceSongId);
    if (existing) {
      return existing;
    }

    if (sameOrganization) {
      songIdMap.set(sourceSongId, sourceSongId);
      return sourceSongId;
    }

    const song = songsById.get(sourceSongId);
    if (!song) {
      throw new Error(`Missing source song ${sourceSongId}`);
    }

    const newSongId = newId();
    songIdMap.set(sourceSongId, newSongId);
    songsToCreate.push({
      song: { ...song, id: newSongId },
      sourceOrganizationId: source.organizationId,
    });
    return newSongId;
  }

  function resolveChart(sourceChartId: string): { chartId: string; songId: string } {
    const chart = chartsById.get(sourceChartId);
    if (!chart) {
      throw new Error(`Missing source chart ${sourceChartId}`);
    }

    const mappedChartId = chartIdMap.get(sourceChartId);
    if (mappedChartId) {
      return { chartId: mappedChartId, songId: songIdMap.get(chart.songId)! };
    }

    if (sameOrganization) {
      chartIdMap.set(sourceChartId, sourceChartId);
      songIdMap.set(chart.songId, chart.songId);
      return { chartId: sourceChartId, songId: chart.songId };
    }

    const originUrl = chart.origin?.url ? canonicalizeOriginUrl(chart.origin.url) : undefined;
    if (originUrl) {
      const reused = existingTargetChartsByOriginUrl.get(originUrl);
      if (reused) {
        chartIdMap.set(sourceChartId, reused.chartId);
        songIdMap.set(chart.songId, reused.songId);
        return reused;
      }
    }

    const targetSongId = resolveSong(chart.songId);
    const newChartId = newId();
    chartIdMap.set(sourceChartId, newChartId);
    chartsToCreate.push({
      chart: { ...chart, id: newChartId, songId: targetSongId },
      sourceOrganizationId: source.organizationId,
    });
    return { chartId: newChartId, songId: targetSongId };
  }

  const items: ClonePlanItemCreate[] = source.items.map((item) => {
    if (item.kind === "note") {
      return {
        id: newId(),
        kind: "note",
        text: item.text,
        ...(item.notes ? { notes: item.notes } : {}),
      };
    }

    const resolved = resolveChart(item.chartId);
    return {
      id: newId(),
      kind: "song",
      songId: resolved.songId,
      chartId: resolved.chartId,
      selectedKey: item.selectedKey,
      ...(item.notes ? { notes: item.notes } : {}),
    };
  });

  return {
    songsToCreate,
    chartsToCreate,
    setlist: {
      id: newId(),
      organizationId: target.organizationId,
      ownerTeamId: target.ownerTeamId,
      title: source.title,
      ...(source.eventType ? { eventType: source.eventType } : {}),
      status: "draft",
      visibility: target.ownerTeamId ? "team" : "organization",
      ...(source.notes ? { notes: source.notes } : {}),
    },
    items,
  };
}
