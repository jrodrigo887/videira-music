import Link from "next/link";
import { notFound } from "next/navigation";

import { SetlistActions } from "@/components/setlists/setlist-actions";
import { ImportedBadge } from "@/components/setlists/imported-badge";
import { canPerform } from "@/lib/setlists/setlist-policy";
import { notFoundIfSetlistMissing } from "@/lib/setlists/setlist-not-found";
import { resolveSelectedTeam } from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import type { Setlist } from "@/types/setlist";

export const dynamic = "force-dynamic";

type SetlistDetailPageProps = {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export default async function SetlistDetailPage({ params, searchParams }: SetlistDetailPageProps) {
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

  const followTeams = selectableTeams.filter((team) =>
    canPerform(actor, "follow", {
      type: "destination",
      organizationId: DEFAULT_ORGANIZATION_ID,
      teamId: team.id,
    }),
  );

  const cloneTeams = selectableTeams.filter((team) =>
    canPerform(actor, "clone", {
      type: "destination",
      organizationId: DEFAULT_ORGANIZATION_ID,
      teamId: team.id,
    }),
  );

  const canCloneOrganization = canPerform(actor, "clone", {
    type: "destination",
    organizationId: DEFAULT_ORGANIZATION_ID,
    teamId: null,
  });

  const showFollowActions =
    setlist.ownerTeamId === null || setlist.ownerTeamId !== selectedTeam?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ds-eyebrow">Setlist</p>
          <h1 className="text-3xl font-bold tracking-tight text-content">{setlist.title}</h1>
          {setlist.eventType ? (
            <p className="mt-2 text-content-muted">Tipo: {setlist.eventType}</p>
          ) : null}
          {setlist.eventAt ? (
            <p className="text-content-muted">Data: {new Date(setlist.eventAt).toLocaleString("pt-BR")}</p>
          ) : null}
          {setlist.notes ? <p className="mt-3 text-content-muted">{setlist.notes}</p> : null}
        </div>
        <Link href={`/setlists${teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : ""}`} className="ds-link">
          Voltar para setlists
        </Link>
      </div>

      {showFollowActions ? (
        <SetlistActions
          setlist={setlist}
          followTeams={followTeams}
          cloneTeams={cloneTeams}
          canCloneOrganization={canCloneOrganization}
          teamQuery={teamQuery}
        />
      ) : (
        <SetlistActions
          setlist={setlist}
          followTeams={[]}
          cloneTeams={cloneTeams}
          canCloneOrganization={canCloneOrganization}
          teamQuery={teamQuery}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-content">Itens</h2>
        {setlist.items.length === 0 ? (
          <p className="text-content-muted">Este setlist ainda não tem itens.</p>
        ) : (
          <ol className="space-y-3">
            {setlist.items.map((item, index) => (
              <li key={item.id} className="ds-card">
                {item.kind === "note" ? (
                  <p className="whitespace-pre-wrap text-content">{item.text}</p>
                ) : item.unavailable ? (
                  <p className="font-semibold text-content-muted">
                    {index + 1}. {item.title} (indisponível)
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-content">
                      {index + 1}. {item.song.title}
                      {item.song.artist ? ` — ${item.song.artist}` : ""}
                    </p>
                    <p className="text-sm text-content-muted">
                      Tom {item.selectedKey} · Cifra {item.chart.key}
                    </p>
                    {item.chart.imported ? <ImportedBadge originUrl={item.chart.originUrl} /> : null}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
