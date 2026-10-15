import { hasRole } from "@/lib/auth/actor";
import { can } from "@/lib/auth/permissions";
import { requirePageActor } from "@/lib/auth/page-gate";
import { UsersAdmin } from "@/components/users/users-admin";
import { listPendingInvites } from "@/lib/invites/invite-service";
import { listMembers } from "@/lib/members/member-service";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  if (!isDatabaseConfigured()) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Banco de dados não configurado.</p>
      </section>
    );
  }

  const actor = await requirePageActor("/usuarios");
  if (!can(actor, "users:manage", { organizationId: actor.organizationId })) {
    return (
      <section className="ds-card text-center">
        <h1 className="text-2xl font-bold text-content">Acesso restrito</h1>
        <p className="mt-3 text-content-muted">Somente administradores e gestores podem gerenciar usuários.</p>
      </section>
    );
  }

  const prisma = getPrisma();

  const [members, invites, teams] = await Promise.all([
    listMembers(prisma, actor),
    listPendingInvites(prisma, actor),
    prisma.worshipTeam.findMany({
      where: { organizationId: actor.organizationId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  const canGrantAdmin = hasRole(actor, "admin", actor.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Administração</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">Usuários</h1>
        <p className="mt-2 text-content-muted">
          Convites, papéis e acesso dos membros da igreja.
        </p>
      </div>
      <UsersAdmin
        members={members}
        invites={invites}
        teams={teams.map((team) => ({
          id: team.id,
          organizationId: team.organizationId,
          slug: team.slug,
          name: team.name,
        }))}
        canGrantAdmin={canGrantAdmin}
        currentUserId={actor.userId}
      />
    </div>
  );
}
