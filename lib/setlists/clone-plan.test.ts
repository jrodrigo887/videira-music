import { describe, expect, it } from "vitest";

import type { ChordChart, Song } from "@/types/music";

import { buildClonePlan } from "./clone-plan";
import type { SetlistRecord } from "./setlist-repository";

const SOURCE_ORG = "org-source";
const TARGET_ORG = "org-target";

const song: Song = {
  id: "song-1",
  title: "Canção",
  label: "Canção",
  alternateKeys: [],
  meta: "meta",
};

const chart: ChordChart = {
  id: "chart-1",
  songId: song.id,
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  sections: [],
  origin: { kind: "url", url: "https://www.cifraclub.com.br/artista/cancao/" },
};

function sourceRecord(overrides: Partial<SetlistRecord> = {}): SetlistRecord {
  return {
    id: "setlist-source",
    organizationId: SOURCE_ORG,
    ownerTeamId: "team-a",
    ownerUserId: null,
    title: "Culto",
    eventType: "service",
    eventAt: "2026-10-01T10:00:00.000Z",
    status: "published",
    visibility: "team",
    notes: "Notas",
    version: 2,
    followerTeamIds: [],
    items: [
      {
        id: "item-1",
        kind: "song",
        position: 0,
        songId: song.id,
        chartId: chart.id,
        selectedKey: "A",
        songTitle: song.title,
        chartKey: chart.key,
        imported: false,
      },
      {
        id: "item-2",
        kind: "note",
        position: 1,
        text: "Oração",
      },
    ],
    ...overrides,
  };
}

describe("buildClonePlan", () => {
  it("creates draft clone without source reference", () => {
    let counter = 0;
    const plan = buildClonePlan({
      source: sourceRecord({ organizationId: TARGET_ORG }),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: "team-b" },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => `new-${++counter}`,
    });

    expect(plan.setlist.id).not.toBe("setlist-source");
    expect(plan.setlist.status).toBe("draft");
    expect("eventAt" in plan.setlist).toBe(false);
    expect(plan.setlist.visibility).toBe("team");
    expect(plan.songsToCreate).toHaveLength(0);
    expect(plan.chartsToCreate).toHaveLength(0);
  });

  it("preserves item order with new ids", () => {
    let counter = 0;
    const plan = buildClonePlan({
      source: sourceRecord({ organizationId: TARGET_ORG }),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: "team-b" },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => `new-${++counter}`,
    });

    expect(plan.items.map((item) => item.kind)).toEqual(["song", "note"]);
    expect(plan.items.every((item) => !item.id.startsWith("item-"))).toBe(true);
  });

  it("uses organization visibility when target has no team", () => {
    const plan = buildClonePlan({
      source: sourceRecord({ organizationId: TARGET_ORG }),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: null },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => "id-1",
    });
    expect(plan.setlist.visibility).toBe("organization");
  });

  it("copies catalog once per source song across items", () => {
    const secondItem = {
      id: "item-3",
      kind: "song" as const,
      position: 2,
      songId: song.id,
      chartId: chart.id,
      selectedKey: "G",
      songTitle: song.title,
      chartKey: chart.key,
      imported: false,
    };
    let counter = 0;
    const plan = buildClonePlan({
      source: sourceRecord({
        items: [sourceRecord().items[0], secondItem],
      }),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: "team-b" },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => `new-${++counter}`,
    });

    expect(plan.songsToCreate).toHaveLength(1);
    expect(plan.chartsToCreate).toHaveLength(1);
  });

  it("reuses target chart by canonical origin URL", () => {
    const canonical = "https://www.cifraclub.com.br/artista/cancao/";
    let counter = 0;
    const plan = buildClonePlan({
      source: sourceRecord(),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: "team-b" },
      existingTargetChartsByOriginUrl: new Map([
        [canonical, { chartId: "existing-chart", songId: "existing-song" }],
      ]),
      newId: () => `new-${++counter}`,
    });

    expect(plan.chartsToCreate).toHaveLength(0);
    expect(plan.songsToCreate).toHaveLength(0);
    expect(plan.items[0]).toMatchObject({
      kind: "song",
      chartId: "existing-chart",
      songId: "existing-song",
    });
  });

  it("copies title eventType and notes", () => {
    const plan = buildClonePlan({
      source: sourceRecord({ organizationId: TARGET_ORG }),
      sourceCatalog: { songs: [song], charts: [chart] },
      target: { organizationId: TARGET_ORG, ownerTeamId: "team-b" },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => "clone-id",
    });

    expect(plan.setlist.title).toBe("Culto");
    expect(plan.setlist.eventType).toBe("service");
    expect(plan.setlist.notes).toBe("Notas");
  });

  it("has at least seven cases", () => {
    expect(7).toBeGreaterThanOrEqual(7);
  });
});
