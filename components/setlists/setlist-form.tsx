"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WorshipTeam } from "@/types/identity";
import type { SetlistEventType, SetlistVisibility } from "@/types/setlist";

export type SetlistDestination =
  | { kind: "team"; team: WorshipTeam }
  | { kind: "organization" };

type SetlistFormProps = {
  destinations: SetlistDestination[];
  defaultDestination?: SetlistDestination;
  teamQuery?: string;
};

type ApiError = { error?: { code?: string; message?: string; issues?: Array<{ path: string; message: string }> } };

export function SetlistForm({ destinations, defaultDestination, teamQuery }: SetlistFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [destinationKey, setDestinationKey] = useState(
    defaultDestination
      ? defaultDestination.kind === "organization"
        ? "organization"
        : defaultDestination.team.id
      : destinations[0]?.kind === "organization"
        ? "organization"
        : destinations[0]?.kind === "team"
          ? destinations[0].team.id
          : "",
  );
  const [visibility, setVisibility] = useState<SetlistVisibility>("team");
  const [eventType, setEventType] = useState<SetlistEventType | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedDestination = destinations.find((entry) =>
    entry.kind === "organization"
      ? destinationKey === "organization"
      : entry.team.id === destinationKey,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (selectedDestination?.kind === "organization") {
        body.owner = "organization";
        body.visibility = visibility === "team" ? "organization" : visibility;
      } else if (selectedDestination?.kind === "team") {
        body.ownerTeamId = selectedDestination.team.id;
        body.visibility = visibility;
      } else {
        setError("Escolha um destino válido.");
        return;
      }
      if (eventType) body.eventType = eventType;
      if (notes.trim()) body.notes = notes.trim();

      const response = await fetch("/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        setError(payload.error?.message ?? "Não foi possível criar o setlist.");
        return;
      }
      const payload = (await response.json()) as { setlist: { id: string } };
      const suffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
      router.push(`/setlists/${encodeURIComponent(payload.setlist.id)}/edit${suffix}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const organizationDestination = selectedDestination?.kind === "organization";

  return (
    <form className="ds-card mx-auto max-w-xl space-y-4" onSubmit={submit}>
      <div>
        <label className="ds-eyebrow mb-2 block" htmlFor="setlist-title">
          Título
        </label>
        <input
          id="setlist-title"
          className="ds-input w-full"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
        />
      </div>

      {destinations.length > 1 ? (
        <div>
          <label className="ds-eyebrow mb-2 block" htmlFor="setlist-destination">
            Dono
          </label>
          <select
            id="setlist-destination"
            className="ds-input w-full"
            value={destinationKey}
            onChange={(event) => setDestinationKey(event.target.value)}
          >
            {destinations.map((entry) =>
              entry.kind === "organization" ? (
                <option key="organization" value="organization">
                  Igreja
                </option>
              ) : (
                <option key={entry.team.id} value={entry.team.id}>
                  {entry.team.name}
                </option>
              ),
            )}
          </select>
        </div>
      ) : null}

      <div>
        <label className="ds-eyebrow mb-2 block" htmlFor="setlist-visibility">
          Visibilidade
        </label>
        <select
          id="setlist-visibility"
          className="ds-input w-full"
          value={organizationDestination ? (visibility === "team" ? "organization" : visibility) : visibility}
          onChange={(event) => setVisibility(event.target.value as SetlistVisibility)}
        >
          {organizationDestination ? (
            <>
              <option value="organization">Igreja</option>
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </>
          ) : (
            <>
              <option value="team">Grupo</option>
              <option value="organization">Igreja</option>
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </>
          )}
        </select>
      </div>

      <div>
        <label className="ds-eyebrow mb-2 block" htmlFor="setlist-event-type">
          Tipo de evento
        </label>
        <select
          id="setlist-event-type"
          className="ds-input w-full"
          value={eventType}
          onChange={(event) => setEventType(event.target.value as SetlistEventType | "")}
        >
          <option value="">Nenhum</option>
          <option value="service">Culto</option>
          <option value="rehearsal">Ensaio</option>
          <option value="event">Evento</option>
        </select>
      </div>

      <div>
        <label className="ds-eyebrow mb-2 block" htmlFor="setlist-notes">
          Notas
        </label>
        <textarea
          id="setlist-notes"
          className="ds-input min-h-24 w-full"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button type="submit" className="ds-button w-full" disabled={busy || !title.trim() || destinations.length === 0}>
        Criar setlist
      </button>
    </form>
  );
}
