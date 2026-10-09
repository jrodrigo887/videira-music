import Link from "next/link";

import type { Song } from "@/types/music";

type SongCardProps = {
  song: Song;
};

export function SongCard({ song }: SongCardProps) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="block rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-content">{song.title}</h2>
          <p className="mt-1 text-sm text-content-muted">{song.meta}</p>
        </div>
        {song.defaultKey ? (
          <span className="ds-badge">
            {song.defaultKey}
          </span>
        ) : null}
      </div>
      {song.artist ? <p className="mt-4 text-sm text-content-subtle">{song.artist}</p> : null}
    </Link>
  );
}
