"use client";

import { useState } from "react";

import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { RoleRecord } from "@/lib/roles/role-service";

import { CAPABILITY_LABELS, readErrorMessage } from "./user-admin-shared";

type RolesPanelProps = {
  initialRoles: RoleRecord[];
  canEditCatalog: boolean;
  onMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
};

export function RolesPanel({
  initialRoles,
  canEditCatalog,
  onMessage,
  busy,
  setBusy,
  onRefresh,
}: RolesPanelProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [label, setLabel] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);

  function toggleCapability(cap: string) {
    setCapabilities((current) =>
      current.includes(cap) ? current.filter((item) => item !== cap) : [...current, cap],
    );
  }

  async function reloadRoles() {
    const response = await fetch("/api/roles");
    if (response.ok) {
      const body = (await response.json()) as { roles: RoleRecord[] };
      setRoles(body.roles);
    }
  }

  async function createRole() {
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, capabilities }),
      });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível criar o papel."));
        return;
      }
      setLabel("");
      setCapabilities([]);
      await onRefresh();
      await reloadRoles();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(key: string) {
    if (!window.confirm("Apagar este papel?")) return;
    setBusy(true);
    onMessage(null);
    try {
      const response = await fetch(`/api/roles/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!response.ok) {
        onMessage(await readErrorMessage(response, "Não foi possível apagar o papel."));
        return;
      }
      await onRefresh();
      await reloadRoles();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {canEditCatalog ? (
        <section className="ds-card space-y-4">
          <h2 className="text-xl font-semibold text-content">Novo papel</h2>
          <label className="block">
            <span className="text-sm font-medium text-content-muted">Nome</span>
            <input
              className="ds-input mt-2"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-content-muted">Capacidades</legend>
            <div className="mt-2 flex flex-col gap-2">
              {CAPABILITIES.map((cap) => (
                <label key={cap} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={capabilities.includes(cap)}
                    onChange={() => toggleCapability(cap)}
                  />
                  {CAPABILITY_LABELS[cap] ?? cap}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className="ds-button"
            disabled={busy || label.trim().length < 2}
            onClick={() => void createRole()}
          >
            Criar papel
          </button>
        </section>
      ) : null}

      <section className="ds-card space-y-4">
        <h2 className="text-xl font-semibold text-content">Catálogo</h2>
        <ul className="divide-y divide-border">
          {roles.map((role) => (
            <li key={role.key} className="space-y-2 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-content">
                    {role.label}
                    {role.system ? (
                      <span className="ml-2 text-xs font-normal text-content-muted">(sistema)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-content-muted font-mono">{role.key}</p>
                </div>
                {canEditCatalog && !role.system ? (
                  <button
                    type="button"
                    className="ds-button-secondary text-sm"
                    disabled={busy}
                    onClick={() => void deleteRole(role.key)}
                  >
                    Apagar
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-content-muted">
                {role.capabilities.length
                  ? role.capabilities.map((cap) => CAPABILITY_LABELS[cap] ?? cap).join(", ")
                  : "Somente leitura"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
