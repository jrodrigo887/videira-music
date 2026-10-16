import { can } from "@/lib/auth/permissions";
import { requirePageActor } from "@/lib/auth/page-gate";
import { NoAccess } from "@/components/auth/no-access";
import { UsersAdmin, type UsersTab } from "@/components/users/users-admin";
import { listPendingAccessRequests } from "@/lib/access-requests/access-request-service";
import { listPendingInvites } from "@/lib/invites/invite-service";
import { listMembers } from "@/lib/members/member-service";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { listRoleLabels, listRoles, type RoleRecord } from "@/lib/roles/role-service";
import { systemCapabilities } from "@/lib/auth/capabilities";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ aba?: string }>;
};

function parseTab(value: string | undefined): UsersTab {
  if (value === "convites" || value === "pedidos" || value === "papeis") {
    return value;
  }
  return "membros";
}

function labelsToRoleRecords(labels: Array<{ key: string; label: string }>): RoleRecord[] {
  return labels.map((entry) => ({
    key: entry.key,
    label: entry.label,
    system: systemCapabilities(entry.key) !== undefined,
    capabilities: [...(systemCapabilities(entry.key) ?? [])],
  }));
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  if (!isDatabaseConfigured()) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Banco de dados não configurado.</p>
      </section>
    );
  }

  const actor = await requirePageActor("/usuarios");
  const organizationId = actor.organizationId;

  const canListMembers = can(actor, "member.manage", { organizationId });
  const canInvite = can(actor, "users:invite", { organizationId });
  const canUserArea = can(actor, "user.manage", { organizationId });
  const canManageRoles = can(actor, "role.manage", { organizationId });

  if (!canListMembers && !canInvite && !canUserArea) {
    return <NoAccess />;
  }

  const params = await searchParams;
  const requestedTab = parseTab(params.aba);
  if (requestedTab === "papeis" && !canManageRoles) {
    return <NoAccess />;
  }

  const initialTab =
    requestedTab === "pedidos" && !canUserArea ? "membros" : requestedTab;

  const prisma = getPrisma();

  const [members, invites, requests, roleLabels, catalogRoles, teams] = await Promise.all([
    canListMembers || canUserArea ? listMembers(prisma, actor) : Promise.resolve([]),
    canInvite ? listPendingInvites(prisma, actor) : Promise.resolve([]),
    canUserArea ? listPendingAccessRequests(prisma, actor) : Promise.resolve([]),
    canListMembers || canUserArea || canManageRoles
      ? listRoleLabels(prisma, actor)
      : Promise.resolve([]),
    canManageRoles ? listRoles(prisma, actor) : Promise.resolve([]),
    prisma.worshipTeam.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  const roles = canManageRoles ? catalogRoles : labelsToRoleRecords(roleLabels);
  const canGrantAdmin = can(actor, "users:grantRole", { organizationId, role: "admin" });

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Administração</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">Usuários</h1>
        <p className="mt-2 text-content-muted">
          Convites, pedidos de acesso, papéis e membros da igreja.
        </p>
      </div>
      <UsersAdmin
        members={members}
        invites={invites}
        requests={requests}
        roles={roles}
        teams={teams.map((team) => ({
          id: team.id,
          organizationId: team.organizationId,
          slug: team.slug,
          name: team.name,
        }))}
        canGrantAdmin={canGrantAdmin}
        canEditCatalog={canManageRoles}
        canChangeRoles={canUserArea}
        showRequestsTab={canUserArea}
        showRolesTab={canManageRoles}
        currentUserId={actor.userId}
        initialTab={initialTab}
      />
    </div>
  );
}
