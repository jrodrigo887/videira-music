import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testUserActor } from "@/lib/auth/test-actor";
import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { Song } from "@/types/music";

import { createSongPutHandler } from "./route";

const ORG = "org-default";

const SONG: Song = {
  id: "song-put-auth",
  title: "Autoria",
  label: "Autoria",
  defaultKey: "G",
  alternateKeys: [],
  meta: "",
  publicLyrics: false,
  createdByUserId: "user-musician",
};

function putRequest(song: Song): Request {
  return new Request(`http://localhost/api/songs/${song.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(song),
  });
}

describe("PUT /api/songs/[songId] authorship", () => {
  const createdBy = new Map<string, string>();

  function handlerWith(repository: InMemoryMusicRepository, actor = testUserActor({
    userId: "user-musician",
    organizationId: ORG,
    roles: ["musician"],
    teams: [],
  })) {
    return createSongPutHandler({
      isConfigured: () => true,
      getRepository: async () => repository,
      getActor: async () => actor,
      findSongAuth: async (songId) => {
        const song = await repository.findSongById(songId);
        if (!song) {
          return null;
        }
        return {
          createdByUserId: song.createdByUserId ?? null,
          publicLyrics: song.publicLyrics ?? false,
        };
      },
      setCreatedByUserId: async (songId, userId) => {
        createdBy.set(songId, userId);
      },
    });
  }

  beforeEach(() => {
    createdBy.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets the author change content fields without music:write", async () => {
    const repository = new InMemoryMusicRepository([SONG], []);
    const handler = handlerWith(repository);
    const updated = { ...SONG, title: "Novo título", artist: "Artista" };

    const response = await handler(putRequest(updated), {
      params: Promise.resolve({ songId: SONG.id }),
    });

    expect(response.status).toBe(204);
    const saved = await repository.findSongById(SONG.id);
    expect(saved?.title).toBe("Novo título");
    expect(saved?.artist).toBe("Artista");
  });

  it("rejects publicLyrics changes for the author without music:write", async () => {
    const repository = new InMemoryMusicRepository([SONG], []);
    const handler = handlerWith(repository);

    const response = await handler(putRequest({ ...SONG, publicLyrics: true }), {
      params: Promise.resolve({ songId: SONG.id }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PUBLIC_LYRICS_FORBIDDEN" },
    });
    const saved = await repository.findSongById(SONG.id);
    expect(saved?.publicLyrics).toBe(false);
  });

  it("sets createdByUserId on first save", async () => {
    const newSong: Song = {
      id: "song-new-author",
      title: "Nova",
      label: "Nova",
      alternateKeys: [],
      meta: "",
    };
    const repository = new InMemoryMusicRepository([], []);
    const handler = handlerWith(
      repository,
      testUserActor({
        userId: "user-leader",
        organizationId: ORG,
        roles: ["worship_leader"],
        teams: [],
      }),
    );

    const response = await handler(putRequest(newSong), {
      params: Promise.resolve({ songId: newSong.id }),
    });

    expect(response.status).toBe(204);
    expect(createdBy.get(newSong.id)).toBe("user-leader");
  });

  it("forbids actors without authorship or music:write", async () => {
    const legacy = { ...SONG, id: "song-legacy", createdByUserId: null };
    const repository = new InMemoryMusicRepository([legacy], []);
    const handler = handlerWith(repository);

    const response = await handler(putRequest({ ...legacy, title: "Hack" }), {
      params: Promise.resolve({ songId: legacy.id }),
    });

    expect(response.status).toBe(403);
  });
});
