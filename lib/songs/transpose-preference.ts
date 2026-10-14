const STORAGE_KEY = "videira-music:song-transpose";

export type SongTransposeStorage = Pick<Storage, "getItem" | "setItem">;

export type TransposePreferenceScope =
  | { kind: "song"; songId: string }
  | { kind: "setlist-item"; setlistId: string; itemId: string };

type PreferenceEntry = {
  semitones: number;
};

type PreferenceMap = Record<string, PreferenceEntry>;

function storageOrDefault(storage?: SongTransposeStorage): SongTransposeStorage | undefined {
  if (storage) {
    return storage;
  }

  if (typeof globalThis.localStorage === "undefined") {
    return undefined;
  }

  return globalThis.localStorage;
}

export function transposePreferenceStorageKey(scope: TransposePreferenceScope): string {
  if (scope.kind === "song") {
    return scope.songId;
  }

  return `setlist:${scope.setlistId}:item:${scope.itemId}`;
}

function readMap(storage: SongTransposeStorage): PreferenceMap {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const map: PreferenceMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      const semitones = (value as PreferenceEntry).semitones;
      if (typeof semitones !== "number" || !Number.isFinite(semitones)) {
        continue;
      }

      map[key] = { semitones: Math.trunc(semitones) };
    }

    return map;
  } catch {
    return {};
  }
}

function writeMap(storage: SongTransposeStorage, map: PreferenceMap): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function readTransposeSemitones(
  scope: TransposePreferenceScope,
  storage?: SongTransposeStorage,
): number | undefined {
  const resolved = storageOrDefault(storage);
  if (!resolved) {
    return undefined;
  }

  return readMap(resolved)[transposePreferenceStorageKey(scope)]?.semitones;
}

export function writeTransposeSemitones(
  scope: TransposePreferenceScope,
  semitones: number,
  storage?: SongTransposeStorage,
): void {
  const resolved = storageOrDefault(storage);
  if (!resolved || !Number.isFinite(semitones)) {
    return;
  }

  const map = readMap(resolved);
  const storageKey = transposePreferenceStorageKey(scope);
  const normalized = Math.trunc(semitones);

  if (normalized === 0) {
    delete map[storageKey];
  } else {
    map[storageKey] = { semitones: normalized };
  }

  writeMap(resolved, map);
}

export function readSongTransposeSemitones(
  songId: string,
  storage?: SongTransposeStorage,
): number | undefined {
  return readTransposeSemitones({ kind: "song", songId }, storage);
}

export function writeSongTransposeSemitones(
  songId: string,
  semitones: number,
  storage?: SongTransposeStorage,
): void {
  writeTransposeSemitones({ kind: "song", songId }, semitones, storage);
}
