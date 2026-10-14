"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FollowersConfirmDialog } from "@/components/setlists/followers-confirm-dialog";
import type { Setlist, SetlistItem, ReplaceSetlistItemInput } from "@/types/setlist";

type EditorItem =
  | {
      id: string;
      kind: "song";
      songId: string;
      chartId: string;
      selectedKey: string;
      label: string;
      notes?: string;
    }
  | { id: string; kind: "note"; text: string; notes?: string; label: string };

type SetlistEditorProps = {
  setlist: Setlist;
  teamQuery?: string;
};

type ApiError = {
  error?: { code?: string; message?: string; version?: number; followerCount?: number };
};

type SongListEntry = { id: string; title: string; artist?: string };
type ChartListEntry = { id: string; title?: string; key: string };

function toEditorItems(items: SetlistItem[]): EditorItem[] {
  return items.map((item) => {
    if (item.kind === "note") {
      return {
        id: item.id,
        kind: "note",
        text: item.text,
        ...(item.notes ? { notes: item.notes } : {}),
        label: item.text,
      };
    }
    const artist = item.song.artist ? ` — ${item.song.artist}` : "";
    return {
      id: item.id,
      kind: "song",
      songId: item.songId,
      chartId: item.chartId,
      selectedKey: item.selectedKey,
      ...(item.notes ? { notes: item.notes } : {}),
      label: `${item.song.title}${artist} (${item.selectedKey})`,
    };
  });
}

function toReplacePayload(items: EditorItem[]): ReplaceSetlistItemInput[] {
  return items.map((item) => {
    if (item.kind === "note") {
      return {
        id: item.id,
        kind: "note",
        text: item.text,
        ...(item.notes ? { notes: item.notes } : {}),
      };
    }
    return {
      id: item.id,
      kind: "song",
      songId: item.songId,
      chartId: item.chartId,
      selectedKey: item.selectedKey,
      ...(item.notes ? { notes: item.notes } : {}),
    };
  });
}

export function SetlistEditor({ setlist: initialSetlist, teamQuery }: SetlistEditorProps) {
  const router = useRouter();
  const [setlist, setSetlist] = useState(initialSetlist);
  const [items, setItems] = useState<EditorItem[]>(() => toEditorItems(initialSetlist.items));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<SongListEntry[]>([]);
  const [pendingSong, setPendingSong] = useState<SongListEntry | null>(null);
  const [pendingCharts, setPendingCharts] = useState<ChartListEntry[]>([]);
  const [pendingChartId, setPendingChartId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [followerDialog, setFollowerDialog] = useState<{
    action: "delete" | "visibility";
    followerCount: number;
    visibility?: string;
  } | null>(null);

  const querySuffix = teamQuery ? `?team=${encodeURIComponent(teamQuery)}` : "";
  const backHref = `/setlists/${encodeURIComponent(setlist.id)}${querySuffix}`;

  const canEdit = setlist.permissions.edit;
  const canChangeStatus = setlist.permissions.changeStatus;
  const canDelete = setlist.permissions.delete;

  const filteredSongs = useMemo(() => {
    const query = songQuery.trim().toLowerCase();
    if (!query) return songResults;
    return songResults.filter((song) => song.title.toLowerCase().includes(query));
  }, [songQuery, songResults]);

  async function loadSongs() {
    const response = await fetch("/api/songs");
    if (!response.ok) return;
    const body = (await response.json()) as { songs: SongListEntry[] };
    setSongResults(body.songs ?? []);
  }

  async function pickSong(song: SongListEntry) {
    setPendingSong(song);
    setPendingChartId("");
    const response = await fetch(`/api/songs/${encodeURIComponent(song.id)}/charts`);
    if (!response.ok) {
      setMessage("Não foi possível carregar as cifras desta música.");
      return;
    }
    const body = (await response.json()) as { charts: ChartListEntry[] };
    const charts = body.charts ?? [];
    setPendingCharts(charts);
    if (charts.length === 1) {
      setPendingChartId(charts[0].id);
    }
  }

  function confirmAddSong() {
    if (!pendingSong || !pendingChartId) {
      setMessage("Escolha a cifra antes de adicionar.");
      return;
    }
    const chart = pendingCharts.find((entry) => entry.id === pendingChartId);
    if (!chart) return;
    const artist = pendingSong.artist ? ` — ${pendingSong.artist}` : "";
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: "song",
        songId: pendingSong.id,
        chartId: chart.id,
        selectedKey: chart.key,
        label: `${pendingSong.title}${artist} (${chart.key})`,
      },
    ]);
    setPendingSong(null);
    setPendingCharts([]);
    setPendingChartId("");
    setMessage(null);
  }

  function addNote() {
    const text = noteText.trim();
    if (!text) {
      setMessage("Digite o texto da anotação.");
      return;
    }
    setItems((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: "note", text, label: text },
    ]);
    setNoteText("");
    setMessage(null);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [entry] = copy.splice(index, 1);
      copy.splice(target, 0, entry);
      return copy;
    });
  }

  function updateSelectedKey(index: number, key: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index || item.kind !== "song") return item;
        return { ...item, selectedKey: key, label: item.label.replace(/\([^)]*\)$/, `(${key})`) };
      }),
    );
  }

  async function saveItems() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: setlist.version,
          items: toReplacePayload(items),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        if (body.error?.code === "SETLIST_VERSION_CONFLICT") {
          setMessage("Este setlist mudou. Recarregue para ver a versão atual.");
          return;
        }
        setMessage(body.error?.message ?? "Não foi possível salvar os itens.");
        return;
      }
      const body = (await response.json()) as { setlist: Setlist };
      setSetlist(body.setlist);
      setItems(toEditorItems(body.setlist.items));
    } finally {
      setBusy(false);
    }
  }

  async function patchSetlist(body: Record<string, unknown>) {
    const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      if (payload.error?.code === "SETLIST_HAS_FOLLOWERS" && payload.error.followerCount !== undefined) {
        setFollowerDialog({
          action: body.status ? "delete" : "visibility",
          followerCount: payload.error.followerCount,
          visibility: typeof body.visibility === "string" ? body.visibility : undefined,
        });
        return null;
      }
      setMessage(payload.error?.message ?? "Não foi possível atualizar o setlist.");
      return null;
    }
    const payload = (await response.json()) as { setlist: Setlist };
    setSetlist(payload.setlist);
    setItems(toEditorItems(payload.setlist.items));
    return payload.setlist;
  }

  async function publish() {
    setBusy(true);
    await patchSetlist({ expectedVersion: setlist.version, status: "published" });
    setBusy(false);
  }

  async function archive() {
    setBusy(true);
    await patchSetlist({ expectedVersion: setlist.version, status: "archived" });
    setBusy(false);
  }

  async function deleteSetlist(confirmFollowersImpact = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/setlists/${encodeURIComponent(setlist.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: setlist.version,
          ...(confirmFollowersImpact ? { confirmFollowersImpact: true } : {}),
        }),
      });
      if (response.status === 409) {
        const body = (await response.json()) as ApiError;
        if (body.error?.code === "SETLIST_HAS_FOLLOWERS" && body.error.followerCount !== undefined) {
          setFollowerDialog({ action: "delete", followerCount: body.error.followerCount });
          return;
        }
      }
      if (!response.ok) {
        setMessage("Não foi possível excluir o setlist.");
        return;
      }
      router.push(`/setlists${querySuffix}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Você não tem permissão para editar este setlist.</p>
        <Link href={backHref} className="ds-link mt-4 inline-block">
          Voltar
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ds-eyebrow">Editor</p>
          <h1 className="text-2xl font-bold text-content">{setlist.title}</h1>
        </div>
        <Link href={backHref} className="ds-link">
          Voltar ao detalhe
        </Link>
      </div>

      {message ? (
        <p role="alert" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="ds-card space-y-3">
        <h2 className="font-semibold text-content">Itens</h2>
        {items.length === 0 ? (
          <p className="text-content-muted">Nenhum item ainda.</p>
        ) : (
          <ol className="space-y-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2 sm:flex-row sm:items-center">
                <span className="flex-1 text-sm text-content">{item.label}</span>
                {item.kind === "song" ? (
                  <input
                    className="ds-input w-24"
                    value={item.selectedKey}
                    aria-label={`Tom de ${item.label}`}
                    onChange={(event) => updateSelectedKey(index, event.target.value)}
                  />
                ) : null}
                <div className="flex gap-2">
                  <button type="button" className="ds-button-secondary" disabled={busy || index === 0} onClick={() => moveItem(index, -1)}>
                    Subir
                  </button>
                  <button
                    type="button"
                    className="ds-button-secondary"
                    disabled={busy || index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  >
                    Descer
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="ds-button" disabled={busy} onClick={saveItems}>
          Salvar itens
        </button>
      </section>

      <section className="ds-card space-y-3">
        <h2 className="font-semibold text-content">Adicionar música</h2>
        <button type="button" className="ds-button-secondary" onClick={loadSongs}>
          Carregar catálogo
        </button>
        <input
          className="ds-input w-full"
          placeholder="Buscar música"
          value={songQuery}
          onChange={(event) => setSongQuery(event.target.value)}
          aria-label="Buscar música"
        />
        <ul className="space-y-1">
          {filteredSongs.slice(0, 8).map((song) => (
            <li key={song.id}>
              <button type="button" className="ds-link" onClick={() => pickSong(song)}>
                {song.title}
              </button>
            </li>
          ))}
        </ul>
        {pendingSong ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">{pendingSong.title}</p>
            {pendingCharts.length > 1 ? (
              <select
                className="ds-input w-full"
                value={pendingChartId}
                onChange={(event) => setPendingChartId(event.target.value)}
                aria-label="Escolher cifra"
              >
                <option value="">Escolha a cifra</option>
                {pendingCharts.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {(chart.title ?? "Cifra") + ` (${chart.key})`}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" className="ds-button-secondary" onClick={confirmAddSong}>
              Adicionar música
            </button>
          </div>
        ) : null}
      </section>

      <section className="ds-card space-y-3">
        <h2 className="font-semibold text-content">Adicionar anotação</h2>
        <textarea
          className="ds-input min-h-20 w-full"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          aria-label="Texto da anotação"
        />
        <button type="button" className="ds-button-secondary" onClick={addNote}>
          Adicionar anotação
        </button>
      </section>

      {canChangeStatus ? (
        <section className="ds-card flex flex-wrap gap-2">
          {setlist.status !== "published" ? (
            <button type="button" className="ds-button" disabled={busy} onClick={publish}>
              Publicar
            </button>
          ) : null}
          {setlist.status === "published" ? (
            <button type="button" className="ds-button-secondary" disabled={busy} onClick={archive}>
              Arquivar
            </button>
          ) : null}
          {setlist.status === "archived" ? (
            <button type="button" className="ds-button" disabled={busy} onClick={publish}>
              Republicar
            </button>
          ) : null}
        </section>
      ) : null}

      {canDelete ? (
        <section className="ds-card">
          <button type="button" className="ds-button-secondary" disabled={busy} onClick={() => deleteSetlist()}>
            Excluir setlist
          </button>
        </section>
      ) : null}

      <FollowersConfirmDialog
        open={followerDialog !== null}
        followerCount={followerDialog?.followerCount ?? 0}
        busy={busy}
        onCancel={() => setFollowerDialog(null)}
        onConfirm={() => {
          const dialog = followerDialog;
          setFollowerDialog(null);
          if (!dialog) return;
          if (dialog.action === "delete") {
            void deleteSetlist(true);
          }
        }}
      />
    </div>
  );
}
