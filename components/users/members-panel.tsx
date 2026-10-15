"use client";

import { useMemo, useState } from "react";

import type { RoleRecord } from "@/lib/roles/role-service";
import type { WorshipTeam } from "@/types/identity";

import {
  formatRoleLabel,
  type MemberRow,
  readErrorMessage,
} from "./user-admin-shared";

type MembersPanelProps = {
  initialMembers: MemberRow[];
  roles: RoleRecord[];
  teams: WorshipTeam[];
  canGrantAdmin: boolean;
  currentUserId: string;
  onMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
};

export function MembersPanel({
  initialMembers,
  roles,
  teams,
  canGrantAdmin,
  currentUserId,
  onMessage,
  busy,
  setBusy,
  onRefresh,
}: MembersPanelProps) {
  const [members, setMembers] = useState(initialMembers);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialMembers.map((member) => [member.id, [...member.roles]])),
  );

  const roleLabels = useMemo(
    () => new Map(roles.map((role) => [role.key, role.label])),
    [roles],
  );

  const assignableRoles = useMemo(
    () => roles.filter((role) => role.key !== "admin" || canGrantAdmin),
    [roles, canGrantAdmin],
  );

  function toggleMemberRole(userId: string, roleKey: string) {
    setRoleDrafts((current) => {
      const draft = current[userId] ?? [];
      const next = draft.includes(roleKey)
        ? draft.filter((item) => item !== roleKey)
        : [...draft, roleKey];
      return { ...current, [userId]: next.length ? next : draft };
    });
  }

  async function saveMemberRoles(userId: string) {
    setBusy(true);
    onMessage(null);
    try {
      const roleKeys = roleDrafts[userId] ?? [];
      const response = await fetch(`/api/members/${encodeURIComponent(userId)}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: roleKeys }),
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível atualizar os papéis."));
        return;
      }
      await onRefresh();
      const membersResponse = await fetch("/api/members");
      if (membersResponse.ok) {
        const body = (await membersResponse.json()) as { members: MemberRow[] };
        setMembers(body.members);
        setRoleDrafts(
          Object.fromEntries(body.members.map((member) => [member.id, [...member.roles]])),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function deactivateMember(userId: string) {
    if (!window.confirm("Desativar este usuário? As sessões dele serão encerradas.")) {
      return;
    }
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(`/api/members/${encodeURIComponent(userId)}/deactivate`, {
        method: "POST",
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível desativar o usuário."));
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  );

  return (
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
                    {assignableRoles.map((role) => {
                      const disabled = lockedForManager && role.key === "admin";
                      return (
                        <label key={role.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={draft.includes(role.key)}
                            disabled={disabled || lockedForManager}
                            onChange={() => toggleMemberRole(member.id, role.key)}
                          />
                          {formatRoleLabel(role.key, roleLabels)}
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
                <p className="text-xs text-content-muted">
                  {member.roles.map((key) => formatRoleLabel(key, roleLabels)).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
