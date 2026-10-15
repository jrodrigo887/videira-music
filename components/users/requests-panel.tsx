"use client";

import { useMemo, useState } from "react";

import type { AccessRequestSummary } from "@/lib/access-requests/access-request-service";
import type { RoleRecord } from "@/lib/roles/role-service";
import type { WorshipTeam } from "@/types/identity";

import { formatRoleLabel, readErrorMessage } from "./user-admin-shared";

type RequestsPanelProps = {
  initialRequests: AccessRequestSummary[];
  roles: RoleRecord[];
  teams: WorshipTeam[];
  canGrantAdmin: boolean;
  onMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
};

export function RequestsPanel({
  initialRequests,
  roles,
  teams,
  canGrantAdmin,
  onMessage,
  busy,
  setBusy,
  onRefresh,
}: RequestsPanelProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [draftRoles, setDraftRoles] = useState<Record<string, string[]>>({});
  const [draftTeams, setDraftTeams] = useState<Record<string, string[]>>({});

  const roleLabels = useMemo(
    () => new Map(roles.map((role) => [role.key, role.label])),
    [roles],
  );

  const assignableRoles = useMemo(
    () => roles.filter((role) => role.key !== "admin" || canGrantAdmin),
    [roles, canGrantAdmin],
  );

  function rolesFor(id: string): string[] {
    return draftRoles[id] ?? ["musician"];
  }

  function teamsFor(id: string): string[] {
    return draftTeams[id] ?? [];
  }

  function toggleRole(id: string, roleKey: string) {
    setDraftRoles((current) => {
      const list = current[id] ?? ["musician"];
      const next = list.includes(roleKey)
        ? list.filter((item) => item !== roleKey)
        : [...list, roleKey];
      return { ...current, [id]: next.length ? next : list };
    });
  }

  function toggleTeam(id: string, teamId: string) {
    setDraftTeams((current) => {
      const list = current[id] ?? [];
      const next = list.includes(teamId)
        ? list.filter((item) => item !== teamId)
        : [...list, teamId];
      return { ...current, [id]: next };
    });
  }

  async function approve(id: string) {
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(`/api/access-requests/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: rolesFor(id), teamIds: teamsFor(id) }),
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível liberar o pedido."));
        return;
      }
      setRequests((current) => current.filter((item) => item.id !== id));
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(`/api/access-requests/${encodeURIComponent(id)}/reject`, {
        method: "POST",
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível recusar o pedido."));
        return;
      }
      setRequests((current) => current.filter((item) => item.id !== id));
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ds-card space-y-4">
      <h2 className="text-xl font-semibold text-content">Pedidos pendentes</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-content-muted">Nenhum pedido pendente.</p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((request) => (
            <li key={request.id} className="space-y-3 py-4">
              <div>
                <p className="font-medium text-content">{request.name}</p>
                <p className="text-sm text-content-muted">{request.email}</p>
                <p className="text-xs text-content-muted">
                  Pedido em {new Date(request.requestedAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-content-muted">Papéis</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {assignableRoles.map((role) => (
                    <label key={role.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={rolesFor(request.id).includes(role.key)}
                        onChange={() => toggleRole(request.id, role.key)}
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
                          checked={teamsFor(request.id).includes(team.id)}
                          onChange={() => toggleTeam(request.id, team.id)}
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ds-button text-sm"
                  disabled={busy}
                  onClick={() => void approve(request.id)}
                >
                  Liberar
                </button>
                <button
                  type="button"
                  className="ds-button-secondary text-sm"
                  disabled={busy}
                  onClick={() => void reject(request.id)}
                >
                  Recusar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
