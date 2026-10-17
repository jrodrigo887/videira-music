import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportedBadge } from "@/components/setlists/imported-badge";
import { notFoundIfSetlistMissing } from "@/lib/setlists/setlist-not-found";
import { resolveSelectedTeam } from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { buildSetlistSongHref } from "@/lib/songs/setlist-song-context";
import type { Setlist } from "@/types/setlist";

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M11.5 2.5a1.2 1.2 0 0 1 1.7 1.7L5.8 11.6 3 12.3l.7-2.8 7.4-7.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 4 12 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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
  const querySuffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
  const listHref = `/setlists${querySuffix}`;
  const editHref = `/setlists/${encodeURIComponent(setlist.id)}/edit${querySuffix}`;
  const optionsHref = `/setlists/${encodeURIComponent(setlist.id)}${querySuffix}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ds-eyebrow">Modo leitura</p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-content">{setlist.title}</h1>
            {setlist.permissions.edit ? (
              <Link
                href={editHref}
                aria-label="Editar setlist"
                title="Editar setlist"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content-muted shadow-xs transition hover:border-primary hover:text-primary"
              >
                <PencilIcon />
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href={listHref} className="ds-link">
            Voltar para setlists
          </Link>
          <Link href={optionsHref} className="text-sm font-semibold text-content-muted transition hover:text-content">
            Mais ações
          </Link>
        </div>
      </div>

      {setlist.items.length === 0 ? (
        <p className="text-content-muted">Este setlist ainda não tem itens para leitura.</p>
      ) : (
        <ol className="space-y-3">
          {setlist.items.map((item, index) => (
            <li key={item.id} className="ds-card">
              {item.kind === "note" ? (
                <p className="whitespace-pre-wrap text-content">{item.text}</p>
              ) : item.unavailable ? (
                <p className="text-lg font-semibold text-content-muted">
                  {index + 1}. {item.title} (indisponível)
                </p>
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
                  {item.notes ? (
                    <p className="whitespace-pre-wrap text-sm text-content-muted">{item.notes}</p>
                  ) : null}
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
