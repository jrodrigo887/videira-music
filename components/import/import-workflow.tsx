"use client";

import { useEffect, useMemo, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { previewImport } from "@/lib/import/preview-import";
import {
  saveImportedChart,
  type SaveImportedChartInput,
} from "@/lib/import/save-imported-chart";
import { HttpMusicRepository } from "@/lib/persistence/http-music-repository";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import { normalizeSearchPart } from "@/lib/persistence/search-text";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, SectionType, Song } from "@/types/music";

const MAX_TEXT_BYTES = 500 * 1024;

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: "intro", label: "Introdução" },
  { value: "verse", label: "Verso" },
  { value: "preChorus", label: "Pré-refrão" },
  { value: "chorus", label: "Refrão" },
  { value: "bridge", label: "Ponte" },
  { value: "instrumental", label: "Instrumental" },
  { value: "solo", label: "Solo" },
  { value: "ending", label: "Final" },
];

type ImportWorkflowProps = {
  initialSongs?: Song[];
  urlImportEnabled: boolean;
  repository?: MusicRepository;
  requestUrlImport?: (url: string) => Promise<ImportDraft>;
  onNavigate?: (path: string) => void;
};

type SongChoice =
  | { kind: "existing"; songId: string }
  | { kind: "new"; title: string; artist?: string };

async function requestCifraClubImport(url: string): Promise<ImportDraft> {
  const response = await fetch("/api/imports/cifraclub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error?.message ?? "Não foi possível importar a URL.");
  }

  return body;
}

function chartForPreview(draft: ImportDraft): ChordChart {
  return {
    ...draft.chart,
    id: `preview-${draft.id}`,
    songId: "preview",
  };
}

export function ImportWorkflow({
  initialSongs = [],
  urlImportEnabled,
  repository: suppliedRepository,
  requestUrlImport = requestCifraClubImport,
  onNavigate = (path) => window.location.assign(path),
}: ImportWorkflowProps) {
  const repository = useMemo(
    () => suppliedRepository ?? new HttpMusicRepository(),
    [suppliedRepository],
  );
  const [catalogSongs, setCatalogSongs] = useState<Song[]>(initialSongs);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<ImportDraft>();
  const [confirmedKey, setConfirmedKey] = useState<string>();
  const [songChoice, setSongChoice] = useState<SongChoice>();
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    repository
      .listSongs()
      .then((songs) => {
        if (active) {
          setCatalogSongs(songs);
        }
      })
      .catch(() => {
        if (active && initialSongs.length) {
          setCatalogSongs(initialSongs);
        }
      });
    return () => {
      active = false;
    };
  }, [repository, initialSongs]);

  const suggestions = useMemo(() => {
    if (!draft?.song.title && !draft?.song.artist) return catalogSongs;

    const title = normalizeSearchPart(draft.song.title);
    const artist = normalizeSearchPart(draft.song.artist);
    return catalogSongs.filter((song) => {
      const titleMatches = title && normalizeSearchPart(song.title).includes(title);
      const artistMatches = artist && normalizeSearchPart(song.artist).includes(artist);
      return titleMatches || artistMatches;
    });
  }, [draft, catalogSongs]);

  function beginReview(nextDraft: ImportDraft) {
    setDraft(nextDraft);
    setConfirmedKey(undefined);
    setSongChoice(undefined);
    setError(undefined);
  }

  function reviewText() {
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (!text.trim()) {
      setError("Informe o texto da cifra.");
      return;
    }
    if (byteLength > MAX_TEXT_BYTES) {
      setError("O texto deve ter no máximo 500 KiB.");
      return;
    }

    beginReview(previewImport({ text }));
  }

  async function importUrl() {
    const requestedUrl = url.trim();
    if (!requestedUrl) {
      setError("Informe a URL do Cifra Club.");
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const existing = await repository.findChartByOriginUrl(requestedUrl);
      if (existing) {
        onNavigate(`/songs/${existing.songId}`);
        return;
      }
      beginReview(await requestUrlImport(requestedUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar a URL.");
    } finally {
      setBusy(false);
    }
  }

  function changeSectionType(sectionId: string, type: SectionType) {
    setDraft((current) => current && ({
      ...current,
      chart: {
        ...current.chart,
        sections: current.chart.sections.map((section) =>
          section.id === sectionId ? { ...section, type } : section,
        ),
      },
    }));
  }

  async function save() {
    if (!draft || !confirmedKey || !songChoice) return;

    setBusy(true);
    setError(undefined);
    try {
      const input: SaveImportedChartInput = {
        draft,
        confirmedKey,
        song: songChoice,
      };
      const result = await saveImportedChart(input, repository);
      onNavigate(`/songs/${result.song.id}`);
    } catch {
      setError("Nada foi salvo. Revise os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <section className="space-y-6">
        {error ? <p role="alert" className="ds-card-muted">{error}</p> : null}

        <div className="ds-card space-y-4">
          <div>
            <p className="ds-eyebrow">Texto colado</p>
            <h2 className="mt-2 text-xl font-semibold text-content">Cole uma cifra</h2>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-content-muted">Texto da cifra</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="ds-input mt-2 min-h-48 font-mono"
            />
          </label>
          <button type="button" className="ds-button" onClick={reviewText}>
            Revisar texto
          </button>
        </div>

        {urlImportEnabled ? (
          <div className="ds-card space-y-4">
            <div>
              <p className="ds-eyebrow">Importação local</p>
              <h2 className="mt-2 text-xl font-semibold text-content">Buscar no Cifra Club</h2>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-content-muted">URL do Cifra Club</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="ds-input mt-2"
              />
            </label>
            <button type="button" className="ds-button-secondary" disabled={busy} onClick={importUrl}>
              Importar URL
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const key = draft.song.defaultKey ?? draft.chart.key;
  const canSave = Boolean(confirmedKey && songChoice && !busy);

  return (
    <section className="space-y-6">
      <div>
        <p className="ds-eyebrow">Revisão obrigatória</p>
        <h1 className="mt-2 text-2xl font-bold text-content">Revisar importação</h1>
        <p className="mt-2 text-content-muted">
          {draft.stats.sections} {draft.stats.sections === 1 ? "seção" : "seções"} ·{" "}
          {draft.stats.lyricLines} {draft.stats.lyricLines === 1 ? "linha" : "linhas"} ·{" "}
          {draft.stats.chords} {draft.stats.chords === 1 ? "acorde" : "acordes"}
        </p>
      </div>

      {error ? <p role="alert" className="ds-card-muted">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="ds-card">
          <h2 className="text-xl font-semibold text-content">Texto original</h2>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm text-content-muted">
            {draft.rawText}
          </pre>
        </article>
        <ChordChartPreview chart={chartForPreview(draft)} />
      </div>

      {draft.warnings.length ? (
        <section className="ds-card-muted">
          <h2 className="font-semibold text-content">Avisos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {draft.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.line ?? index}`}>
                {warning.line ? `Linha ${warning.line}: ` : ""}{warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ds-card space-y-4">
        <h2 className="text-xl font-semibold text-content">Seções e tom</h2>
        {draft.chart.sections.map((section) => (
          <label key={section.id} className="block">
            <span className="text-sm font-medium text-content-muted">{section.label}</span>
            <select
              aria-label={`Tipo de ${section.label}`}
              value={section.type}
              onChange={(event) => changeSectionType(section.id, event.target.value as SectionType)}
              className="ds-input mt-2"
            >
              {SECTION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={confirmedKey === key}
            onChange={(event) => setConfirmedKey(event.target.checked ? key : undefined)}
          />
          <span>Confirmar tom {key}</span>
        </label>
      </section>

      <section className="ds-card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-content">Vincular música</h2>
          <p className="mt-1 text-sm text-content-muted">
            Confirme uma sugestão ou crie uma música. Nenhuma opção é selecionada automaticamente.
          </p>
        </div>
        {suggestions.map((song) => (
          <label key={song.id} className="flex items-center gap-3">
            <input
              type="radio"
              name="song"
              aria-label={`Vincular ${song.title}`}
              checked={songChoice?.kind === "existing" && songChoice.songId === song.id}
              onChange={() => setSongChoice({ kind: "existing", songId: song.id })}
            />
            <span>{song.title}{song.artist ? ` · ${song.artist}` : ""}</span>
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-sm font-medium text-content-muted">Nova música</span>
            <input
              value={newSongTitle}
              onChange={(event) => setNewSongTitle(event.target.value)}
              className="ds-input mt-2"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-content-muted">Artista</span>
            <input
              value={newSongArtist}
              onChange={(event) => setNewSongArtist(event.target.value)}
              className="ds-input mt-2"
            />
          </label>
        </div>
        <button
          type="button"
          className="ds-button-secondary"
          disabled={!newSongTitle.trim()}
          onClick={() => setSongChoice({
            kind: "new",
            title: newSongTitle.trim(),
            ...(newSongArtist.trim() ? { artist: newSongArtist.trim() } : {}),
          })}
        >
          Confirmar nova música
        </button>
      </section>

      <button type="button" className="ds-button" disabled={!canSave} onClick={save}>
        Salvar cifra
      </button>
    </section>
  );
}
