import { redirect } from "next/navigation";

import { NoAccess } from "@/components/auth/no-access";
import { TeamManager } from "@/components/groups/team-manager";
import { can } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/current-actor";
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

  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    redirect("/entrar?next=%2Fgroups");
  }

  if (!can(actor, "teams:manage", { organizationId: actor.organizationId })) {
    return <NoAccess />;
  }

  const teamService = await dependencies.getTeamService();
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
}
