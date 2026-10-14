"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WorshipTeam } from "@/types/identity";

type TeamManagerProps = {
  activeTeams: WorshipTeam[];
  archivedTeams: WorshipTeam[];
};

type ApiError = { error?: { message?: string } };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function TeamManager({ activeTeams, archivedTeams }: TeamManagerProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function refresh() {
    router.refresh();
  }

  async function createTeam() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível criar o grupo."));
        return;
      }
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function renameTeam(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível renomear o grupo."));
        return;
      }
      setEditingId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function archiveTeam(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível arquivar o grupo."));
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-content">
          {message}
        </p>
      ) : null}

      <section className="ds-card space-y-4">
        <h2 className="text-lg font-bold text-content">Novo grupo</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="ds-input flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do grupo"
            aria-label="Nome do grupo"
          />
          <button type="button" className="ds-button shrink-0" disabled={busy || !name.trim()} onClick={createTeam}>
            Criar grupo
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-content">Grupos ativos</h2>
        {activeTeams.length === 0 ? (
          <p className="text-content-muted">Nenhum grupo ativo.</p>
        ) : (
          <ul className="space-y-3">
            {activeTeams.map((team) => (
              <li key={team.id} className="ds-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {editingId === team.id ? (
                  <input
                    className="ds-input flex-1"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    aria-label={`Renomear ${team.name}`}
                  />
                ) : (
                  <div>
                    <p className="font-semibold text-content">{team.name}</p>
                    <p className="text-xs text-content-muted">/{team.slug}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {editingId === team.id ? (
                    <>
                      <button type="button" className="ds-button-secondary" disabled={busy} onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                      <button type="button" className="ds-button" disabled={busy || !editingName.trim()} onClick={() => renameTeam(team.id)}>
                        Salvar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ds-button-secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(team.id);
                          setEditingName(team.name);
                        }}
                      >
                        Renomear
                      </button>
                      <button type="button" className="ds-button-secondary" disabled={busy} onClick={() => archiveTeam(team.id)}>
                        Arquivar
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archivedTeams.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-content">Grupos arquivados</h2>
          <ul className="space-y-2">
            {archivedTeams.map((team) => (
              <li key={team.id} className="ds-card-muted text-content-muted">
                {team.name} <span className="text-xs">(/{team.slug})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
