import Link from "next/link";

import { UnfollowSetlistButton } from "@/components/setlists/unfollow-setlist-button";
import {
  buildSetlistsQuery,
  canCreateSetlistForContext,
  parseSetlistTab,
  resolveSelectedTeam,
  SETLIST_TAB_OPTIONS,
} from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import type { FollowedEntry, SetlistSummary } from "@/types/setlist";

export const dynamic = "force-dynamic";

type SetlistsPageProps = {
  searchParams: Promise<{ team?: string; tab?: string }>;
};

function statusLabel(status: SetlistSummary["status"]): string {
  if (status === "draft") return "Rascunho";
  if (status === "archived") return "Arquivado";
  return "Publicado";
}

function SetlistSummaryCard({ setlist, teamQuery }: { setlist: SetlistSummary; teamQuery?: string }) {
  const suffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
  return (
    <Link href={`/setlists/${encodeURIComponent(setlist.id)}${suffix}`} className="ds-card block transition hover:border-primary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-content">{setlist.title}</h2>
        <span className="ds-badge">{statusLabel(setlist.status)}</span>
      </div>
      {setlist.eventType ? (
        <p className="mt-2 text-sm text-content-muted">Evento: {setlist.eventType}</p>
      ) : null}
    </Link>
  );
}

function FollowedSetlistCard({
  entry,
  teamId,
  teamQuery,
}: {
  entry: FollowedEntry;
  teamId: string;
  teamQuery?: string;
}) {
  if (!entry.available) {
    return (
      <div className="ds-card-muted flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-content-muted">Setlist indisponível</p>
        <UnfollowSetlistButton setlistId={entry.setlistId} teamId={teamId} />
      </div>
    );
  }

  const suffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
  return (
    <div className="ds-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/setlists/${encodeURIComponent(entry.setlist.id)}${suffix}`} className="flex-1">
        <h2 className="text-lg font-semibold text-content">{entry.setlist.title}</h2>
        <span className="ds-badge mt-2 inline-block">{statusLabel(entry.setlist.status)}</span>
      </Link>
      <UnfollowSetlistButton setlistId={entry.setlistId} teamId={teamId} />
    </div>
  );
}

export default async function SetlistsPage({ searchParams }: SetlistsPageProps) {
  const { team: teamSlug, tab: tabParam } = await searchParams;
  const dependencies = createSetlistRouteDependencies();

  if (!dependencies.isConfigured()) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Banco de dados não configurado.</p>
      </section>
    );
  }

  const actor = await dependencies.getActor();
  const teamService = await dependencies.getTeamService();
  const setlistService = await dependencies.getSetlistService();
  const selectableTeams = await teamService.teamsSelectableBy(actor);
  const selectedTeam = resolveSelectedTeam(selectableTeams, teamSlug);
  const tab = selectedTeam ? parseSetlistTab(tabParam) : "organization";
  const visibleTabs = selectedTeam
    ? SETLIST_TAB_OPTIONS
    : SETLIST_TAB_OPTIONS.filter((entry) => entry.id === "organization");

  const entries = await setlistService.listTab(actor, { team: selectedTeam, tab });
  const showCreate = canCreateSetlistForContext(actor, DEFAULT_ORGANIZATION_ID, selectedTeam);
  const teamQuery = selectedTeam?.slug;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ds-eyebrow">Repertório</p>
          <h1 className="text-3xl font-bold tracking-tight text-content">Setlists</h1>
        </div>
        {showCreate ? (
          <Link
            href={`/setlists/new${teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : ""}`}
            className="ds-button"
          >
            Novo setlist
          </Link>
        ) : null}
      </div>

      {selectableTeams.length > 0 ? (
        <nav aria-label="Grupos" className="flex flex-wrap gap-2">
          {selectableTeams.map((team) => {
            const active = selectedTeam?.id === team.id;
            return (
              <Link
                key={team.id}
                href={`/setlists${buildSetlistsQuery(team, tab)}`}
                className={active ? "ds-button" : "ds-button-secondary"}
                aria-current={active ? "page" : undefined}
              >
                {team.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <nav aria-label="Abas de setlists" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {visibleTabs.map((entry) => {
          const active = tab === entry.id;
          return (
            <Link
              key={entry.id}
              href={`/setlists${buildSetlistsQuery(selectedTeam, entry.id)}`}
              className={active ? "ds-link font-semibold text-primary" : "ds-link text-content-muted"}
              aria-current={active ? "page" : undefined}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-content-muted">Nenhum setlist nesta aba.</p>
        ) : tab === "following" ? (
          (entries as FollowedEntry[]).map((entry) => (
            <FollowedSetlistCard
              key={entry.setlistId}
              entry={entry}
              teamId={selectedTeam!.id}
              teamQuery={teamQuery}
            />
          ))
        ) : (
          (entries as SetlistSummary[]).map((setlist) => (
            <SetlistSummaryCard key={setlist.id} setlist={setlist} teamQuery={teamQuery} />
          ))
        )}
      </div>
    </div>
  );
}
