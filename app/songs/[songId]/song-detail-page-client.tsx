"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { parseSetlistSongContext } from "@/lib/songs/setlist-song-context";

import { SongDetail } from "./song-detail";

type SongDetailPageClientProps = {
  songId: string;
  importLinkVisible?: boolean;
  canEditMusic?: boolean;
  currentUserId?: string;
};

export function SongDetailPageClient({
  songId,
  importLinkVisible = false,
  canEditMusic = false,
  currentUserId,
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
      canEditMusic={canEditMusic}
      currentUserId={currentUserId}
      setlistContext={setlistContext}
    />
  );
}
