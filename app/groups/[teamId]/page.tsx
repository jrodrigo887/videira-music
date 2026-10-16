import { notFound } from "next/navigation";

import { TeamInviteForm } from "@/components/groups/team-invite-form";
import { teamRoleOf } from "@/lib/auth/actor";
import { requirePageActor } from "@/lib/auth/page-gate";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamPage({ params }: PageProps) {
  if (!isDatabaseConfigured()) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Banco de dados não configurado.</p>
      </section>
    );
  }

  const { teamId } = await params;
  const actor = await requirePageActor(`/groups/${teamId}`);
  const prisma = getPrisma();

  const team = await prisma.worshipTeam.findFirst({
    where: {
      id: teamId,
      organizationId: actor.organizationId,
      archivedAt: null,
    },
    select: { id: true, name: true, slug: true },
  });
  if (!team) {
    notFound();
  }

  const membership = actor.teams.some((entry) => entry.teamId === teamId);
  if (!membership) {
    notFound();
  }

  const isLeader = teamRoleOf(actor, teamId) === "leader";

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Grupo</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">{team.name}</h1>
        <p className="mt-2 text-content-muted">/{team.slug}</p>
      </div>
      {isLeader ? <TeamInviteForm teamId={team.id} teamName={team.name} /> : null}
    </div>
  );
}
