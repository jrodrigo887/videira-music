import type { SetlistItem, SetlistSongItem } from "@/types/setlist";

export type SetlistSongContext = {
  setlistId: string;
  setlistItemId: string;
  /** Tom definido no item da setlist (antes de ajustes do usuário). */
  selectedKey?: string;
};

type SearchParamSource = Pick<URLSearchParams, "get">;

export function parseSetlistSongContext(
  searchParams: SearchParamSource,
): SetlistSongContext | undefined {
  const setlistId = searchParams.get("setlist")?.trim();
  const setlistItemId = searchParams.get("item")?.trim();

  if (!setlistId || !setlistItemId) {
    return undefined;
  }

  const selectedKey = searchParams.get("key")?.trim();

  return {
    setlistId,
    setlistItemId,
    ...(selectedKey ? { selectedKey } : {}),
  };
}

/** Link para abrir a cifra no contexto de um item de setlist. */
export function buildSetlistSongHref(
  songId: string,
  context: SetlistSongContext,
): string {
  const params = new URLSearchParams({
    setlist: context.setlistId,
    item: context.setlistItemId,
  });

  if (context.selectedKey) {
    params.set("key", context.selectedKey);
  }

  return `/songs/${encodeURIComponent(songId)}?${params.toString()}`;
}

export type SetlistSongNeighbors = {
  previous?: SetlistSongItem;
  next?: SetlistSongItem;
};

/** Vizinhos de música na ordem do setlist, ignorando anotações. */
export function findSongNeighbors(
  items: SetlistItem[],
  setlistItemId: string,
): SetlistSongNeighbors {
  const songs = items.filter((item): item is SetlistSongItem => item.kind === "song");
  const index = songs.findIndex((item) => item.id === setlistItemId);
  if (index === -1) {
    return {};
  }
  return {
    ...(index > 0 ? { previous: songs[index - 1] } : {}),
    ...(index < songs.length - 1 ? { next: songs[index + 1] } : {}),
  };
}
