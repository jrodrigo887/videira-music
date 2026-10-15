"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { InviteSummary } from "@/lib/invites/invite-service";
import type { OrganizationRole, WorshipTeam } from "@/types/identity";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "deactivated";
  roles: OrganizationRole[];
  teamIds: string[];
};

type UsersAdminProps = {
  members: MemberRow[];
  invites: InviteSummary[];
  teams: WorshipTeam[];
  canGrantAdmin: boolean;
  currentUserId: string;
};

type ApiError = { error?: { code?: string; message?: string } };

const ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  worship_leader: "Líder de louvor",
  musician: "Músico",
};

const ASSIGNABLE_ROLES: OrganizationRole[] = [
  "admin",
  "manager",
  "worship_leader",
  "musician",
];

const EXPIRY_PRESETS = [
  { label: "1 hora", hours: 1 },
  { label: "1 dia", hours: 24 },
  { label: "7 dias", hours: 24 * 7 },
  { label: "30 dias", hours: 24 * 30 },
] as const;

function formatRoles(roles: OrganizationRole[]): string {
  return roles.map((role) => ROLE_LABELS[role]).join(", ");
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    if (body.error?.code === "LAST_ADMIN") {
      return "A igreja precisa de ao menos um administrador ativo.";
    }
    if (body.error?.code === "USER_EXISTS") {
      return "Já existe um usuário ativo com este e-mail.";
    }
    if (body.error?.code === "FORBIDDEN") {
      return "Sem permissão para esta ação.";
    }
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function UsersAdmin({
  members: initialMembers,
  invites: initialInvites,
  teams,
  canGrantAdmin,
  currentUserId,
}: UsersAdminProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<OrganizationRole[]>(["musician"]);
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [inviteExpiryHours, setInviteExpiryHours] = useState<number>(24 * 7);
  const [createdInvite, setCreatedInvite] = useState<{
    link: string;
    expiresAt: string;
    email: string;
  } | null>(null);

  const [roleDrafts, setRoleDrafts] = useState<Record<string, OrganizationRole[]>>(() =>
    Object.fromEntries(initialMembers.map((member) => [member.id, [...member.roles]])),
  );

  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  );

  async function refreshLists() {
    const [membersResponse, invitesResponse] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/invites"),
    ]);
    if (membersResponse.ok) {
      const body = (await membersResponse.json()) as { members: MemberRow[] };
      setMembers(body.members);
      setRoleDrafts(
        Object.fromEntries(body.members.map((member) => [member.id, [...member.roles]])),
      );
    }
    if (invitesResponse.ok) {
      const body = (await invitesResponse.json()) as { invites: InviteSummary[] };
      setInvites(body.invites);
    }
    router.refresh();
  }

  function toggleInviteRole(role: OrganizationRole) {
    setInviteRoles((current) => {
      if (current.includes(role)) {
        const next = current.filter((item) => item !== role);
        return next.length ? next : current;
      }
      return [...current, role];
    });
  }

  function toggleInviteTeam(teamId: string) {
    setInviteTeamIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  }

  async function createInvite() {
    setBusy(true);
    setMessage(null);
    setCreatedInvite(null);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          roles: inviteRoles,
          teamIds: inviteTeamIds,
          expiresInHours: inviteExpiryHours,
        }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível criar o convite."));
        return;
      }
      const body = (await response.json()) as {
        invite: InviteSummary;
        link: string;
      };
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setCreatedInvite({
        link: `${origin}${body.link}`,
        expiresAt: body.invite.expiresAt,
        email: body.invite.email,
      });
      setInviteEmail("");
      await refreshLists();
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite.link);
      setMessage("Link copiado.");
    } catch {
      setMessage("Não foi possível copiar o link.");
    }
  }

  function shareWhatsApp() {
    if (!createdInvite) return;
    const text = encodeURIComponent(
      `Você foi convidado ao Videira Music. Entre com a conta Google ${createdInvite.email}: ${createdInvite.link}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível revogar o convite."));
        return;
      }
      await refreshLists();
    } finally {
      setBusy(false);
    }
  }

  function toggleMemberRole(userId: string, role: OrganizationRole) {
    setRoleDrafts((current) => {
      const draft = current[userId] ?? [];
      const next = draft.includes(role)
        ? draft.filter((item) => item !== role)
        : [...draft, role];
      return { ...current, [userId]: next.length ? next : draft };
    });
  }

  async function saveMemberRoles(userId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const roles = roleDrafts[userId] ?? [];
      const response = await fetch(`/api/members/${encodeURIComponent(userId)}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível atualizar os papéis."));
        return;
      }
      await refreshLists();
    } finally {
      setBusy(false);
    }
  }

  async function deactivateMember(userId: string) {
    if (!window.confirm("Desativar este usuário? As sessões dele serão encerradas.")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/members/${encodeURIComponent(userId)}/deactivate`, {
        method: "POST",
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível desativar o usuário."));
        return;
      }
      await refreshLists();
    } finally {
      setBusy(false);
    }
  }

  const selectableRoles = ASSIGNABLE_ROLES.filter((role) => role !== "admin" || canGrantAdmin);

  return (
    <div className="space-y-8">
      {message ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-content">
          {message}
        </p>
      ) : null}

      <section className="ds-card space-y-4">
        <div>
          <p className="ds-eyebrow">Convite</p>
          <h2 className="text-xl font-semibold text-content">Convidar pessoa</h2>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-content-muted">E-mail</span>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            className="ds-input mt-2"
            autoComplete="off"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-content-muted">Papéis</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {selectableRoles.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inviteRoles.includes(role)}
                  onChange={() => toggleInviteRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </fieldset>
        {teams.length ? (
          <fieldset>
            <legend className="text-sm font-medium text-content-muted">Grupos (opcional)</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inviteTeamIds.includes(team.id)}
                    onChange={() => toggleInviteTeam(team.id)}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-content-muted">Validade</span>
          <select
            className="ds-input mt-2"
            value={inviteExpiryHours}
            onChange={(event) => setInviteExpiryHours(Number(event.target.value))}
          >
            {EXPIRY_PRESETS.map((preset) => (
              <option key={preset.hours} value={preset.hours}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ds-button"
          disabled={busy || !inviteEmail.trim() || inviteRoles.length === 0}
          onClick={() => void createInvite()}
        >
          Gerar convite
        </button>
        {createdInvite ? (
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
            <p>
              Convite para <strong>{createdInvite.email}</strong> · expira em{" "}
              {new Date(createdInvite.expiresAt).toLocaleString("pt-BR")}
            </p>
            <p className="mt-2 break-all font-mono text-xs">{createdInvite.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="ds-button-secondary text-sm" onClick={() => void copyInviteLink()}>
                Copiar link
              </button>
              <button type="button" className="ds-button-secondary text-sm" onClick={shareWhatsApp}>
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ds-card space-y-4">
        <h2 className="text-xl font-semibold text-content">Convites pendentes</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-content-muted">Nenhum convite pendente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-content">{invite.email}</p>
                  <p className="text-xs text-content-muted">
                    {formatRoles(invite.roles)} · convidado por{" "}
                    {invite.createdByName ?? invite.createdByUserId} · válido até{" "}
                    {new Date(invite.expiresAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  className="ds-button-secondary text-sm"
                  disabled={busy}
                  onClick={() => void revokeInvite(invite.id)}
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ds-card space-y-4">
        <h2 className="text-xl font-semibold text-content">Membros</h2>
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isAdminMember = member.roles.includes("admin");
            const lockedForManager = isAdminMember && !canGrantAdmin;
            const draft = roleDrafts[member.id] ?? member.roles;
            const rolesDirty =
              draft.length !== member.roles.length ||
              draft.some((role) => !member.roles.includes(role));

            return (
              <li key={member.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-content">
                      {member.name}
                      {member.status === "deactivated" ? (
                        <span className="ml-2 text-xs font-normal text-content-muted">(desativado)</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-content-muted">{member.email}</p>
                    {member.teamIds.length ? (
                      <p className="mt-1 text-xs text-content-muted">
                        Grupos:{" "}
                        {member.teamIds.map((id) => teamNameById.get(id) ?? id).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {member.status === "active" && member.id !== currentUserId && !lockedForManager ? (
                    <button
                      type="button"
                      className="ds-button-secondary text-sm"
                      disabled={busy}
                      onClick={() => void deactivateMember(member.id)}
                    >
                      Desativar
                    </button>
                  ) : null}
                </div>
                {member.status === "active" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-3">
                      {selectableRoles.map((role) => {
                        const disabled = lockedForManager && role === "admin";
                        return (
                          <label key={role} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.includes(role)}
                              disabled={disabled || lockedForManager}
                              onChange={() => toggleMemberRole(member.id, role)}
                            />
                            {ROLE_LABELS[role]}
                          </label>
                        );
                      })}
                    </div>
                    {rolesDirty && !lockedForManager ? (
                      <button
                        type="button"
                        className="ds-button-secondary text-sm"
                        disabled={busy}
                        onClick={() => void saveMemberRoles(member.id)}
                      >
                        Salvar papéis
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-content-muted">{formatRoles(member.roles)}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
