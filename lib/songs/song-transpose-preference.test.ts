import { describe, expect, it } from "vitest";

import {
  readSongTransposeSemitones,
  readTransposeSemitones,
  writeSongTransposeSemitones,
  writeTransposeSemitones,
  type SongTransposeStorage,
} from "./transpose-preference";

function createMemoryStorage(): SongTransposeStorage {
  const entries = new Map<string, string>();

  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
  };
}

describe("song-transpose-preference", () => {
  it("returns undefined when nothing was saved", () => {
    const storage = createMemoryStorage();
    expect(readSongTransposeSemitones("song-1", storage)).toBeUndefined();
  });

  it("persists and reads semitone offset per song", () => {
    const storage = createMemoryStorage();

    writeSongTransposeSemitones("song-1", 2, storage);
    writeSongTransposeSemitones("song-2", -1, storage);

    expect(readSongTransposeSemitones("song-1", storage)).toBe(2);
    expect(readSongTransposeSemitones("song-2", storage)).toBe(-1);
  });

  it("removes the entry when semitones return to zero", () => {
    const storage = createMemoryStorage();

    writeSongTransposeSemitones("song-1", 3, storage);
    writeSongTransposeSemitones("song-1", 0, storage);

    expect(readSongTransposeSemitones("song-1", storage)).toBeUndefined();
  });

  it("stores transpose separately per setlist item", () => {
    const storage = createMemoryStorage();

    writeTransposeSemitones(
      { kind: "setlist-item", setlistId: "sl-1", itemId: "item-1" },
      1,
      storage,
    );
    writeSongTransposeSemitones("song-1", 4, storage);

    expect(
      readTransposeSemitones(
        { kind: "setlist-item", setlistId: "sl-1", itemId: "item-1" },
        storage,
      ),
    ).toBe(1);
    expect(readSongTransposeSemitones("song-1", storage)).toBe(4);
  });
});
