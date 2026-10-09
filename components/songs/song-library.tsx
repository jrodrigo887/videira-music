"use client";

import { useMemo, useState } from "react";

import { searchSongs } from "@/lib/data/songs";
import type { Song } from "@/types/music";

import { SongCard } from "./song-card";

type SongLibraryProps = {
  initialSongs: Song[];
};

export function SongLibrary({ initialSongs }: SongLibraryProps) {
  const [query, setQuery] = useState("");

  const songs = useMemo(() => {
    if (!query.trim()) {
      return initialSongs;
    }

    return searchSongs(query);
  }, [initialSongs, query]);

  return (
    <section className="space-y-6">
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
        {songs.length} de {initialSongs.length} musicas no catalogo inicial
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </section>
  );
}
