import { TeamManager } from "@/components/groups/team-manager";
import { SetlistError } from "@/lib/setlists/setlist-errors";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
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

  try {
    const allTeams = await teamService.listTeams(actor, { includeArchived: true });
    const activeTeams = allTeams.filter((team) => !team.archivedAt);
    const archivedTeams = allTeams.filter((team) => team.archivedAt);

    return (
      <div className="space-y-6">
        <div>
          <p className="ds-eyebrow">Administração</p>
          <h1 className="text-3xl font-bold tracking-tight text-content">Grupos de louvor</h1>
          <p className="mt-2 text-content-muted">Crie, renomeie e arquive grupos da igreja.</p>
        </div>
        <TeamManager activeTeams={activeTeams} archivedTeams={archivedTeams} />
      </div>
    );
  } catch (error) {
    if (error instanceof SetlistError && error.status === 403) {
      return (
        <section className="ds-card text-center">
          <h1 className="text-2xl font-bold text-content">Acesso restrito</h1>
          <p className="mt-3 text-content-muted">Acesso restrito ao administrador da igreja.</p>
        </section>
      );
    }
    throw error;
  }
}
