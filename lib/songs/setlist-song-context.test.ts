import { describe, expect, it } from "vitest";

import { buildSetlistSongHref, parseSetlistSongContext } from "./setlist-song-context";

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
});
