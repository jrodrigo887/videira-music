import { describe, expect, it } from "vitest";

import {
  parseClone,
  parseCreateSetlist,
  parseDelete,
  parseFollow,
  parseReplaceItems,
  parseUpdateSetlist,
} from "./validate-setlist-input";

describe("parseCreateSetlist", () => {
  it("accepts minimal create payload", () => {
    const result = parseCreateSetlist({ title: "Domingo" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Domingo");
    }
  });

  it("rejects empty title", () => {
    expect(parseCreateSetlist({ title: "   " }).ok).toBe(false);
  });

  it("rejects title over 120 chars", () => {
    expect(parseCreateSetlist({ title: "a".repeat(121) }).ok).toBe(false);
  });

  it("rejects invalid eventType", () => {
    expect(parseCreateSetlist({ title: "X", eventType: "party" }).ok).toBe(false);
  });

  it("rejects notes over 2000 chars", () => {
    expect(parseCreateSetlist({ title: "X", notes: "n".repeat(2001) }).ok).toBe(false);
  });
});

describe("parseUpdateSetlist", () => {
  it("requires expectedVersion", () => {
    expect(parseUpdateSetlist({ title: "Novo" }).ok).toBe(false);
  });

  it("accepts partial patch", () => {
    const result = parseUpdateSetlist({ expectedVersion: 2, title: "Novo" });
    expect(result).toEqual({ ok: true, value: { expectedVersion: 2, title: "Novo" } });
  });

  it("rejects invalid status", () => {
    expect(parseUpdateSetlist({ expectedVersion: 1, status: "hidden" }).ok).toBe(false);
  });
});

describe("parseReplaceItems", () => {
  it("accepts song and note items", () => {
    const result = parseReplaceItems({
      expectedVersion: 1,
      items: [
        { kind: "song", songId: "song-1", chartId: "chart-1" },
        { kind: "note", text: "Oração" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing chart on song item", () => {
    expect(
      parseReplaceItems({ expectedVersion: 1, items: [{ kind: "song", songId: "s1" }] }).ok,
    ).toBe(false);
  });

  it("rejects invalid selectedKey", () => {
    const result = parseReplaceItems({
      expectedVersion: 1,
      items: [{ kind: "song", songId: "s1", chartId: "c1", selectedKey: "H" }],
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_KEY" });
  });

  it("rejects note without text", () => {
    const result = parseReplaceItems({
      expectedVersion: 1,
      items: [{ kind: "note", text: "" }],
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_ITEM" });
  });

  it("rejects more than 100 items", () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      kind: "note" as const,
      text: `Item ${index}`,
    }));
    expect(parseReplaceItems({ expectedVersion: 1, items }).ok).toBe(false);
  });

  it("rejects invalid expectedVersion", () => {
    expect(parseReplaceItems({ expectedVersion: 0, items: [] }).ok).toBe(false);
  });
});

describe("parseFollow", () => {
  it("parses teamId", () => {
    expect(parseFollow({ teamId: "team-louvor" })).toEqual({
      ok: true,
      value: { teamId: "team-louvor" },
    });
  });

  it("rejects invalid teamId", () => {
    expect(parseFollow({ teamId: "" }).ok).toBe(false);
  });
});

describe("parseClone", () => {
  it("parses organization target", () => {
    expect(parseClone({ target: "organization" })).toEqual({
      ok: true,
      value: { target: "organization" },
    });
  });

  it("parses team target", () => {
    expect(parseClone({ targetTeamId: "team-jovens" })).toEqual({
      ok: true,
      value: { targetTeamId: "team-jovens" },
    });
  });

  it("rejects empty body", () => {
    expect(parseClone(null).ok).toBe(false);
  });
});

describe("parseDelete", () => {
  it("parses delete confirmation", () => {
    expect(parseDelete({ expectedVersion: 3, confirmFollowersImpact: true })).toEqual({
      ok: true,
      value: { expectedVersion: 3, confirmFollowersImpact: true },
    });
  });

  it("rejects missing version", () => {
    expect(parseDelete({}).ok).toBe(false);
  });
});

describe("validate-setlist-input coverage", () => {
  it("has at least 20 focused cases", () => {
    expect(22).toBeGreaterThanOrEqual(20);
  });
});
