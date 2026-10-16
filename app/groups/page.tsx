import Link from "next/link";
import { redirect } from "next/navigation";

import { NoAccess } from "@/components/auth/no-access";
import { TeamManager } from "@/components/groups/team-manager";
import { can } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { getPrisma } from "@/lib/persistence/prisma-client";
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

  const canManage = can(actor, "teams:manage", { organizationId: actor.organizationId });

  if (canManage) {
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

  const leaderTeamIds = actor.teams
    .filter((membership) => membership.role === "leader")
    .map((membership) => membership.teamId);

  if (leaderTeamIds.length === 0) {
    return <NoAccess />;
  }

  const prisma = getPrisma();
  const ledTeams = await prisma.worshipTeam.findMany({
    where: {
      id: { in: leaderTeamIds },
      organizationId: actor.organizationId,
      archivedAt: null,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Grupos</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">Seus grupos</h1>
        <p className="mt-2 text-content-muted">Grupos em que você é líder.</p>
      </div>
      <ul className="ds-card divide-y divide-border">
        {ledTeams.map((team) => (
          <li key={team.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="font-medium text-content">{team.name}</p>
              <p className="text-sm text-content-muted">/{team.slug}</p>
            </div>
            <Link className="ds-button ds-button-secondary" href={`/groups/${team.id}`}>
              Abrir
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
