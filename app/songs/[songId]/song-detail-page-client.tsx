"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { parseSetlistSongContext } from "@/lib/songs/setlist-song-context";

import { SongDetail } from "./song-detail";

type SongDetailPageClientProps = {
  songId: string;
  importLinkVisible?: boolean;
};

export function SongDetailPageClient({
  songId,
  importLinkVisible = false,
}: SongDetailPageClientProps) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const setlistContext = useMemo(
    () => parseSetlistSongContext(new URLSearchParams(query)),
    [query],
  );

  return (
    <SongDetail
      songId={songId}
      importLinkVisible={importLinkVisible}
      setlistContext={setlistContext}
    />
  );
}
