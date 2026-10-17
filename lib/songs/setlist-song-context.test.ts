import { describe, expect, it } from "vitest";

import { buildSetlistSongHref, findSongNeighbors, parseSetlistSongContext } from "./setlist-song-context";

describe("setlist-song-context", () => {
  it("parses setlist query params", () => {
    const params = new URLSearchParams("setlist=sl-1&item=item-2&key=A");
    expect(parseSetlistSongContext(params)).toEqual({
      setlistId: "sl-1",
      setlistItemId: "item-2",
      selectedKey: "A",
    });
  });

  it("returns undefined without setlist context", () => {
    expect(parseSetlistSongContext(new URLSearchParams())).toBeUndefined();
  });

  it("builds song href with setlist context", () => {
    expect(
      buildSetlistSongHref("song-1", {
        setlistId: "sl-1",
        setlistItemId: "item-2",
        selectedKey: "G",
      }),
    ).toBe("/songs/song-1?setlist=sl-1&item=item-2&key=G");
  });

  it("finds next song skipping notes", () => {
    const neighbors = findSongNeighbors(
      [
        { id: "n1", kind: "note", position: 0, text: "pausa" },
        { id: "s1", kind: "song", position: 1, songId: "a", chartId: "c1", selectedKey: "G", song: { title: "A" }, chart: { key: "G", imported: false } },
        { id: "s2", kind: "song", position: 2, songId: "b", chartId: "c2", selectedKey: "A", song: { title: "B" }, chart: { key: "A", imported: false } },
      ],
      "s1",
    );
    expect(neighbors.previous).toBeUndefined();
    expect(neighbors.next?.songId).toBe("b");
  });

  it("finds previous song skipping notes", () => {
    const neighbors = findSongNeighbors(
      [
        { id: "s1", kind: "song", position: 0, songId: "a", chartId: "c1", selectedKey: "G", song: { title: "A" }, chart: { key: "G", imported: false } },
        { id: "n1", kind: "note", position: 1, text: "pausa" },
        { id: "s2", kind: "song", position: 2, songId: "b", chartId: "c2", selectedKey: "A", song: { title: "B" }, chart: { key: "A", imported: false } },
      ],
      "s2",
    );
    expect(neighbors.previous?.songId).toBe("a");
    expect(neighbors.next).toBeUndefined();
  });

  it("returns empty neighbors for unknown item id", () => {
    expect(findSongNeighbors([], "missing")).toEqual({});
  });

  it("skips unavailable songs when finding neighbors", () => {
    const neighbors = findSongNeighbors(
      [
        { id: "s1", kind: "song", position: 0, songId: "a", chartId: "c1", selectedKey: "G", song: { title: "A" }, chart: { key: "G", imported: false } },
        { id: "gone", kind: "song", position: 1, unavailable: true, title: "Removida" },
        { id: "s2", kind: "song", position: 2, songId: "b", chartId: "c2", selectedKey: "A", song: { title: "B" }, chart: { key: "A", imported: false } },
      ],
      "s1",
    );
    expect(neighbors.next?.songId).toBe("b");
  });
});
