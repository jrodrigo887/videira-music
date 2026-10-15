"use client";

import { useMemo, useState } from "react";

import type { InviteSummary } from "@/lib/invites/invite-service";
import type { RoleRecord } from "@/lib/roles/role-service";
import type { WorshipTeam } from "@/types/identity";

import { formatRoleLabel, readErrorMessage } from "./user-admin-shared";

const EXPIRY_PRESETS = [
  { label: "1 hora", hours: 1 },
  { label: "1 dia", hours: 24 },
  { label: "7 dias", hours: 24 * 7 },
  { label: "30 dias", hours: 24 * 30 },
] as const;

type InvitesPanelProps = {
  initialInvites: InviteSummary[];
  roles: RoleRecord[];
  teams: WorshipTeam[];
  canGrantAdmin: boolean;
  onMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
};

export function InvitesPanel({
  initialInvites,
  roles,
  teams,
  canGrantAdmin,
  onMessage,
  busy,
  setBusy,
  onRefresh,
}: InvitesPanelProps) {
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<string[]>(["musician"]);
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [inviteExpiryHours, setInviteExpiryHours] = useState<number>(24 * 7);
  const [createdInvite, setCreatedInvite] = useState<{
    link: string;
    expiresAt: string;
    email: string;
  } | null>(null);

  const roleLabels = useMemo(
    () => new Map(roles.map((role) => [role.key, role.label])),
    [roles],
  );

  const selectableRoles = useMemo(
    () => roles.filter((role) => role.key !== "admin" || canGrantAdmin),
    [roles, canGrantAdmin],
  );

  function toggleInviteRole(roleKey: string) {
    setInviteRoles((current) => {
      if (current.includes(roleKey)) {
        const next = current.filter((item) => item !== roleKey);
        return next.length ? next : current;
      }
      return [...current, roleKey];
    });
  }

  function toggleInviteTeam(teamId: string) {
    setInviteTeamIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  }

  async function createInvite() {
    setBusy(true);
    onMessage(null);
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
        onMessage(await readErrorMessage(response, "Não foi possível criar o convite."));
        return;
      }
      const body = (await response.json()) as { invite: InviteSummary; link: string };
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setCreatedInvite({
        link: `${origin}${body.link}`,
        expiresAt: body.invite.expiresAt,
        email: body.invite.email,
      });
      setInviteEmail("");
      await onRefresh();
      const invitesResponse = await fetch("/api/invites");
      if (invitesResponse.ok) {
        const parsed = (await invitesResponse.json()) as { invites: InviteSummary[] };
        setInvites(parsed.invites);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite.link);
      onMessage("Link copiado.");
    } catch {
      onMessage("Não foi possível copiar o link.");
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
    onMessage(null);
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível revogar o convite."));
        return;
      }
      await onRefresh();
      const invitesResponse = await fetch("/api/invites");
      if (invitesResponse.ok) {
        const parsed = (await invitesResponse.json()) as { invites: InviteSummary[] };
        setInvites(parsed.invites);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
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
              <label key={role.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inviteRoles.includes(role.key)}
                  onChange={() => toggleInviteRole(role.key)}
                />
                {formatRoleLabel(role.key, roleLabels)}
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
                    {invite.roles.map((key) => formatRoleLabel(key, roleLabels)).join(", ")} · convidado por{" "}
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
    </div>
  );
}
