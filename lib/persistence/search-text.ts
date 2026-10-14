import type { Song } from "@/types/music";

export function normalizeSearchPart(value?: string): string {
  return value?.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR") ?? "";
}

export function buildSongSearchText(song: Song): string {
  return [song.title, song.artist, song.defaultKey, song.meta]
    .filter(Boolean)
    .map((part) => normalizeSearchPart(part))
    .join(" ");
}
