import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportedBadge } from "@/components/setlists/imported-badge";
import { notFoundIfSetlistMissing } from "@/lib/setlists/setlist-not-found";
import { resolveSelectedTeam } from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { buildSetlistSongHref } from "@/lib/songs/setlist-song-context";
import type { Setlist } from "@/types/setlist";

export const dynamic = "force-dynamic";

type SetlistPlayPageProps = {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export default async function SetlistPlayPage({ params, searchParams }: SetlistPlayPageProps) {
  const { setlistId } = await params;
  const { team: teamSlug } = await searchParams;
  const dependencies = createSetlistRouteDependencies();

  if (!dependencies.isConfigured()) {
    notFound();
  }

  const actor = await dependencies.getActor();
  const teamService = await dependencies.getTeamService();
  const setlistService = await dependencies.getSetlistService();

  let setlist: Setlist;
  try {
    setlist = await setlistService.getReadable(actor, setlistId);
  } catch (error) {
    notFoundIfSetlistMissing(error);
  }

  const selectableTeams = await teamService.teamsSelectableBy(actor);
  const selectedTeam = resolveSelectedTeam(selectableTeams, teamSlug);
  const teamQuery = selectedTeam?.slug;
  const backHref = `/setlists/${encodeURIComponent(setlist.id)}${teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ds-eyebrow">Modo leitura</p>
          <h1 className="text-3xl font-bold tracking-tight text-content">{setlist.title}</h1>
        </div>
        <Link href={backHref} className="ds-link">
          Voltar ao setlist
        </Link>
      </div>

      {setlist.items.length === 0 ? (
        <p className="text-content-muted">Este setlist ainda não tem itens para leitura.</p>
      ) : (
        <ol className="space-y-3">
          {setlist.items.map((item, index) => (
            <li key={item.id} className="ds-card">
              {item.kind === "note" ? (
                <p className="whitespace-pre-wrap text-content">{item.text}</p>
              ) : (
                <div className="space-y-2">
                  <Link
                    href={buildSetlistSongHref(item.songId, {
                      setlistId: setlist.id,
                      setlistItemId: item.id,
                      selectedKey: item.selectedKey,
                    })}
                    className="text-lg font-semibold text-primary hover:underline"
                  >
                    {index + 1}. {item.song.title}
                  </Link>
                  <p className="text-sm text-content-muted">Tom {item.selectedKey}</p>
                  {item.chart.imported ? <ImportedBadge originUrl={item.chart.originUrl} /> : null}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
