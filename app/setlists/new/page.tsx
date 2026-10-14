import Link from "next/link";

import { SetlistForm, type SetlistDestination } from "@/components/setlists/setlist-form";
import { canPerform } from "@/lib/setlists/setlist-policy";
import { resolveSelectedTeam } from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

export const dynamic = "force-dynamic";

type NewSetlistPageProps = {
  searchParams: Promise<{ team?: string }>;
};

export default async function NewSetlistPage({ searchParams }: NewSetlistPageProps) {
  const { team: teamSlug } = await searchParams;
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
  const selectableTeams = await teamService.teamsSelectableBy(actor);
  const selectedTeam = resolveSelectedTeam(selectableTeams, teamSlug);

  const destinations: SetlistDestination[] = [];
  for (const team of selectableTeams) {
    if (
      canPerform(actor, "create", {
        type: "destination",
        organizationId: DEFAULT_ORGANIZATION_ID,
        teamId: team.id,
      })
    ) {
      destinations.push({ kind: "team", team });
    }
  }
  if (
    canPerform(actor, "create", {
      type: "destination",
      organizationId: DEFAULT_ORGANIZATION_ID,
      teamId: null,
    })
  ) {
    destinations.push({ kind: "organization" });
  }

  const defaultDestination: SetlistDestination | undefined = selectedTeam
    ? destinations.find(
        (entry) => entry.kind === "team" && entry.team.id === selectedTeam.id,
      ) ?? destinations[0]
    : destinations[0];

  if (destinations.length === 0) {
    return (
      <section className="ds-card">
        <h1 className="text-2xl font-bold text-content">Novo setlist</h1>
        <p className="mt-3 text-content-muted">Você não tem permissão para criar setlists.</p>
        <Link href="/setlists" className="ds-link mt-4 inline-block">
          Voltar
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Setlists</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">Novo setlist</h1>
      </div>
      <SetlistForm
        destinations={destinations}
        defaultDestination={defaultDestination}
        teamQuery={selectedTeam?.slug}
      />
    </div>
  );
}
