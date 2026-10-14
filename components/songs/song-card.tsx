import Link from "next/link";

import type { Song } from "@/types/music";

type SongCardProps = {
  song: Song;
};

export function SongCard({ song }: SongCardProps) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="group block rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-content transition group-hover:text-primary">
            {song.title}
          </h2>
          {song.artist ? (
            <p className="mt-0.5 text-sm font-semibold text-primary">{song.artist}</p>
          ) : null}
          <p className="mt-1 text-xs text-content-muted">{song.meta}</p>
        </div>
        {song.defaultKey ? (
          <span className="ds-badge shrink-0">
            Tom {song.defaultKey}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
