import { findSongById, listSongs } from "@/lib/data/songs";

import { SongDetail } from "./song-detail";

type SongDetailPageProps = {
  params: Promise<{
    songId: string;
  }>;
};

export function generateStaticParams() {
  return listSongs().map((song) => ({
    songId: song.id,
  }));
}

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { songId } = await params;
  return <SongDetail songId={songId} seedSong={findSongById(songId)} />;
}
