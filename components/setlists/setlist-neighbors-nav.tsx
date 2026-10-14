"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  buildSetlistSongHref,
  findSongNeighbors,
  type SetlistSongContext,
} from "@/lib/songs/setlist-song-context";
import type { Setlist } from "@/types/setlist";

type SetlistNeighborsNavProps = {
  setlistContext: SetlistSongContext;
};

type NavState =
  | { status: "idle" | "loading" }
  | { status: "ready"; previousHref?: string; nextHref?: string }
  | { status: "hidden" };

export function SetlistNeighborsNav({ setlistContext }: SetlistNeighborsNavProps) {
  const [state, setState] = useState<NavState>({ status: "idle" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    async function load() {
      try {
        const response = await fetch(`/api/setlists/${encodeURIComponent(setlistContext.setlistId)}`);
        if (!response.ok) {
          if (active) setState({ status: "hidden" });
          return;
        }
        const body = (await response.json()) as { setlist: Setlist };
        const neighbors = findSongNeighbors(body.setlist.items, setlistContext.setlistItemId);
        if (!neighbors.previous && !neighbors.next) {
          if (active) setState({ status: "hidden" });
          return;
        }
        if (active) {
          setState({
            status: "ready",
            ...(neighbors.previous
              ? {
                  previousHref: buildSetlistSongHref(neighbors.previous.songId, {
                    setlistId: setlistContext.setlistId,
                    setlistItemId: neighbors.previous.id,
                    selectedKey: neighbors.previous.selectedKey,
                  }),
                }
              : {}),
            ...(neighbors.next
              ? {
                  nextHref: buildSetlistSongHref(neighbors.next.songId, {
                    setlistId: setlistContext.setlistId,
                    setlistItemId: neighbors.next.id,
                    selectedKey: neighbors.next.selectedKey,
                  }),
                }
              : {}),
          });
        }
      } catch {
        if (active) setState({ status: "hidden" });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [setlistContext.setlistId, setlistContext.setlistItemId]);

  if (state.status !== "ready") {
    return null;
  }

  return (
    <nav
      aria-label="Navegação no setlist"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"
    >
      {state.previousHref ? (
        <Link href={state.previousHref} className="ds-button-secondary">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      {state.nextHref ? (
        <Link href={state.nextHref} className="ds-button-secondary">
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
