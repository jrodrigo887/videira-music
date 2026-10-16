"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TrashedSongSummary } from "@/lib/songs/song-trash-service";

type SongTrashListProps = {
  songs: TrashedSongSummary[];
};

export function SongTrashList({ songs }: SongTrashListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function restore(songId: string) {
    setBusyId(songId);
    setMessage(null);
    try {
      const response = await fetch(`/api/songs/${songId}/restore`, { method: "POST" });
      if (!response.ok) {
        setMessage("Não foi possível restaurar a música.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (songs.length === 0) {
    return <p className="text-content-muted">Nenhuma música na lixeira.</p>;
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
      <ul className="ds-card divide-y divide-border">
        {songs.map((song) => (
          <li
            key={song.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-content">{song.title}</p>
              {song.artist ? <p className="text-sm text-content-muted">{song.artist}</p> : null}
            </div>
            <button
              type="button"
              className="ds-button ds-button-secondary"
              disabled={busyId === song.id}
              onClick={() => restore(song.id)}
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
