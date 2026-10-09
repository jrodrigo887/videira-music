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
        <span className="text-sm font-medium text-slate-700">Buscar por titulo, artista ou tom</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: Aclame, Diante do Trono, A"
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-leaf-500 focus:ring-4 focus:ring-leaf-100"
        />
      </label>

      <p className="text-sm text-slate-600">
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
