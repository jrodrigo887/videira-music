import Link from "next/link";

import type { Song } from "@/types/music";

type SongCardProps = {
  song: Song;
};

export function SongCard({ song }: SongCardProps) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-leaf-500 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{song.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{song.meta}</p>
        </div>
        {song.defaultKey ? (
          <span className="rounded-full bg-leaf-50 px-3 py-1 text-sm font-medium text-leaf-700">
            {song.defaultKey}
          </span>
        ) : null}
      </div>
      {song.artist ? <p className="mt-4 text-sm text-slate-500">{song.artist}</p> : null}
    </Link>
  );
}
