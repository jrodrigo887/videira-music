"use client";

import { useEffect, useMemo, useState } from "react";

import { IndexedDbMusicRepository } from "@/lib/persistence/music-database";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import type { Song } from "@/types/music";

import { SongCard } from "./song-card";

type SongLibraryProps = {
  initialSongs: Song[];
  repository?: MusicRepository;
};

function matchesQuery(song: Song, query: string): boolean {
  const searchable = [song.title, song.artist, song.defaultKey, song.meta]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  return searchable.includes(query);
}

export function SongLibrary({ initialSongs, repository: suppliedRepository }: SongLibraryProps) {
  const [query, setQuery] = useState("");
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [loadError, setLoadError] = useState(false);
  const repository = useMemo(
    () => suppliedRepository ?? new IndexedDbMusicRepository(),
    [suppliedRepository],
  );

  useEffect(() => {
    let active = true;

    repository.listSongs()
      .then((songs) => {
        if (active) setLocalSongs(songs);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [repository]);

  const songs = useMemo(() => {
    const seedIds = new Set(initialSongs.map((song) => song.id));
    const combined = [
      ...initialSongs,
      ...localSongs.filter((song) => !seedIds.has(song.id)),
    ];
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    return normalizedQuery
      ? combined.filter((song) => matchesQuery(song, normalizedQuery))
      : combined;
  }, [initialSongs, localSongs, query]);

  return (
    <section className="space-y-6">
      {loadError ? (
        <p role="alert" className="ds-card-muted">
          Dados locais não puderam ser carregados. O catálogo inicial continua disponível.
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-content-muted">Buscar por titulo, artista ou tom</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: Aclame, Diante do Trono, A"
          className="ds-input mt-2"
        />
      </label>

      <p className="text-sm text-content-muted">
        {songs.length} {songs.length === 1 ? "música" : "músicas"} no catálogo
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </section>
  );
}
