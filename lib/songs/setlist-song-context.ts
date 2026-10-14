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
