import rawSongs from "@/data/musicas.json";
import type { Song, SongId } from "@/types/music";

type SeedSong = {
  id: number;
  title: string;
  meta: string;
  label: string;
};

const KEY_PATTERN = /tom(?:s)?\s+\*\*([^*]+)\*\*(?:,\s+\*\*([^*]+)\*\*)?/i;

function stripMarkdown(value: string): string {
  return value.replaceAll("**", "").trim();
}

function extractKeys(meta: string): string[] {
  const match = meta.match(KEY_PATTERN);

  if (!match) {
    return [];
  }

  return [match[1], match[2]]
    .filter((key): key is string => Boolean(key))
    .map((key) => key.trim());
}

function extractArtist(meta: string): string | undefined {
  const [, artist] = stripMarkdown(meta).split("·").map((part) => part.trim());
  return artist || undefined;
}

function toSong(seed: SeedSong): Song {
  const keys = extractKeys(seed.meta);

  return {
    id: String(seed.id),
    title: seed.title,
    label: seed.label,
    artist: extractArtist(seed.meta),
    genre: "igreja",
    defaultKey: keys[0],
    alternateKeys: keys.slice(1),
    meta: stripMarkdown(seed.meta),
  };
}

const songs = (rawSongs as SeedSong[]).map(toSong);

export function listSongs(): Song[] {
  return songs;
}

export function findSongById(songId: SongId): Song | undefined {
  return songs.find((song) => song.id === songId);
}

export function searchSongs(query: string): Song[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  if (!normalizedQuery) {
    return songs;
  }

  return songs.filter((song) => {
    const searchable = [song.title, song.artist, song.defaultKey, song.meta]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return searchable.includes(normalizedQuery);
  });
}
