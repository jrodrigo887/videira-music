"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { runLocalDataMigration } from "@/lib/persistence/local-data-migration";
import { HttpMusicRepository } from "@/lib/persistence/http-music-repository";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import { normalizeSearchPart } from "@/lib/persistence/search-text";
import type { Song } from "@/types/music";

import { SongCard } from "./song-card";

type SongLibraryProps = {
  repository?: MusicRepository;
};

function matchesQuery(song: Song, query: string): boolean {
  const searchable = [song.title, song.artist, song.defaultKey, song.meta]
    .filter(Boolean)
    .map((part) => normalizeSearchPart(part))
    .join(" ");

  return searchable.includes(query);
}

export function SongLibrary({ repository: suppliedRepository }: SongLibraryProps) {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string>();
  const repository = useMemo(
    () => suppliedRepository ?? new HttpMusicRepository(),
    [suppliedRepository],
  );

  const loadSongs = useCallback(async () => {
    setLoadError(false);
    try {
      const listed = await repository.listSongs();
      setSongs(listed);
    } catch {
      setLoadError(true);
    }
  }, [repository]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const migration = await runLocalDataMigration();
      if (!active) {
        return;
      }
      if (migration.message) {
        setMigrationMessage(migration.message);
      }
      await loadSongs();
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadSongs]);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = normalizeSearchPart(query.trim());
    return normalizedQuery
      ? songs.filter((song) => matchesQuery(song, normalizedQuery))
      : songs;
  }, [query, songs]);

  return (
    <section className="space-y-6">
      {migrationMessage ? (
        <p className="ds-card-muted">{migrationMessage}</p>
      ) : null}

      {loadError ? (
        <p role="alert" className="ds-card-muted">
          Não foi possível carregar o catálogo.{" "}
          <button type="button" className="ds-link" onClick={() => void loadSongs()}>
            Tentar novamente
          </button>
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
        {filteredSongs.length} {filteredSongs.length === 1 ? "música" : "músicas"} no catálogo
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredSongs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </section>
  );
}
