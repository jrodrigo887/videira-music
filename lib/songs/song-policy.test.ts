import { describe, expect, it } from "vitest";

import { testUserActor } from "@/lib/auth/test-actor";

import {
  canChangePublicLyrics,
  canDeleteSong,
  canEditChartContent,
  canEditSongContent,
} from "./song-policy";

const ORG = "org-default";

describe("song-policy", () => {
  const writer = testUserActor({
    userId: "writer",
    organizationId: ORG,
    roles: ["worship_leader"],
    teams: [],
  });
  const musician = testUserActor({
    userId: "musician",
    organizationId: ORG,
    roles: ["musician"],
    teams: [],
  });
  const manager = testUserActor({
    userId: "manager",
    organizationId: ORG,
    roles: ["manager"],
    teams: [],
  });

  const song = {
    organizationId: ORG,
    createdByUserId: "musician",
    deletedAt: null,
  };

  const chart = {
    organizationId: ORG,
    createdByUserId: "musician",
  };

  it("lets the author edit content without music:write", () => {
    expect(canEditSongContent(musician, song)).toBe(true);
    expect(canEditChartContent(musician, chart, song)).toBe(true);
  });

  it("denies non-authors without music:write", () => {
    const other = { ...song, createdByUserId: "other" };
    expect(canEditSongContent(musician, other)).toBe(false);
    expect(canEditChartContent(musician, { ...chart, createdByUserId: "other" }, song)).toBe(
      false,
    );
  });

  it("requires music:write for publicLyrics", () => {
    expect(canChangePublicLyrics(musician, song)).toBe(false);
    expect(canChangePublicLyrics(writer, song)).toBe(true);
  });

  it("requires music:delete to delete songs", () => {
    expect(canDeleteSong(musician, ORG)).toBe(false);
    expect(canDeleteSong(manager, ORG)).toBe(true);
  });

  it("blocks edits when the song is in the trash", () => {
    const trashed = { ...song, deletedAt: new Date() };
    expect(canEditSongContent(writer, trashed)).toBe(false);
    expect(canEditChartContent(writer, chart, trashed)).toBe(false);
  });
});
