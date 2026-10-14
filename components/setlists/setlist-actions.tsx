"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WorshipTeam } from "@/types/identity";
import type { Setlist } from "@/types/setlist";

type SetlistActionsProps = {
  setlist: Setlist;
  followTeams: WorshipTeam[];
  cloneTeams: WorshipTeam[];
  canCloneOrganization: boolean;
  teamQuery?: string;
};

type ApiError = { error?: { code?: string; message?: string } };

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function SetlistActions({
  setlist,
  followTeams,
  cloneTeams,
  canCloneOrganization,
  teamQuery,
}: SetlistActionsProps) {
  const router = useRouter();
  const [followTeamId, setFollowTeamId] = useState(followTeams[0]?.id ?? "");
  const [cloneTarget, setCloneTarget] = useState(
    cloneTeams[0]?.id ?? (canCloneOrganization ? "organization" : ""),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const querySuffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";

  async function follow() {
    if (!followTeamId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: followTeamId }),
      });
      if (!response.ok) {
        setMessage(await readError(response, "Não foi possível seguir este setlist."));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cloneSetlist() {
    setBusy(true);
    setMessage(null);
    try {
      const body =
        cloneTarget === "organization"
          ? { target: "organization" }
          : { targetTeamId: cloneTarget };
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setMessage(await readError(response, "Não foi possível clonar este setlist."));
        return;
      }
      const payload = (await response.json()) as { setlist: { id: string } };
      router.push(`/setlists/${encodeURIComponent(payload.setlist.id)}/edit${querySuffix}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href={`/setlists/${encodeURIComponent(setlist.id)}/play${querySuffix}`} className="ds-button-secondary">
          Modo leitura
        </Link>
        {setlist.permissions.edit ? (
          <Link href={`/setlists/${encodeURIComponent(setlist.id)}/edit${querySuffix}`} className="ds-button">
            Editar
          </Link>
        ) : null}
      </div>

      {followTeams.length > 0 ? (
        <div className="ds-card-muted flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="ds-eyebrow mb-1 block" htmlFor="follow-team">
              Seguir com o grupo
            </label>
            <select
              id="follow-team"
              className="ds-input w-full"
              value={followTeamId}
              onChange={(event) => setFollowTeamId(event.target.value)}
            >
              {followTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="ds-button-secondary shrink-0" disabled={busy} onClick={follow}>
            Seguir setlist
          </button>
        </div>
      ) : null}

      {cloneTeams.length > 0 || canCloneOrganization ? (
        <div className="ds-card-muted flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="ds-eyebrow mb-1 block" htmlFor="clone-target">
              Clonar para
            </label>
            <select
              id="clone-target"
              className="ds-input w-full"
              value={cloneTarget}
              onChange={(event) => setCloneTarget(event.target.value)}
            >
              {cloneTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
              {canCloneOrganization ? <option value="organization">Igreja</option> : null}
            </select>
          </div>
          <button type="button" className="ds-button-secondary shrink-0" disabled={busy || !cloneTarget} onClick={cloneSetlist}>
            Clonar
          </button>
        </div>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}
