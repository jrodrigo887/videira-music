"use client";

import { useEffect, useMemo, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { ChartVersionField } from "@/components/import/chart-version-field";
import { PublicVisibilityField } from "@/components/songs/public-visibility-field";
import {
  SECTION_TYPE_OPTIONS,
  TONALITY_OPTIONS,
} from "@/lib/charts/chart-edit-options";
import {
  CHART_VERSION_PRESETS,
  PRINCIPAL_VERSION_LABEL,
  chartVersionLabel,
} from "@/lib/charts/chart-versions";
import { previewImport } from "@/lib/import/preview-import";
import {
  saveImportedChart,
  type SaveImportedChartInput,
} from "@/lib/import/save-imported-chart";
import { HttpMusicRepository } from "@/lib/persistence/http-music-repository";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import { RepositoryError } from "@/lib/persistence/repository-error";
import { normalizeSearchPart } from "@/lib/persistence/search-text";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, SectionType, Song } from "@/types/music";

const MAX_TEXT_BYTES = 500 * 1024;

const EMPTY_INITIAL_SONGS: Song[] = [];

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
    if (response.status === 401 && body.error?.code === "IMPORT_LOCKED") {
      throw new Error("Sem permissão para importar.");
    }
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
  initialSongs = EMPTY_INITIAL_SONGS,
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
  const [selectedSongKey, setSelectedSongKey] = useState("");
  const [songChoice, setSongChoice] = useState<SongChoice>();
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [publicLyrics, setPublicLyrics] = useState(false);
  const [versionLabel, setVersionLabel] = useState<string>(PRINCIPAL_VERSION_LABEL);
  const [extraVersions, setExtraVersions] = useState<string[]>([]);
  const [songVersions, setSongVersions] = useState<string[]>([]);

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

  useEffect(() => {
    if (songChoice?.kind === "existing") {
      const song = catalogSongs.find((item) => item.id === songChoice.songId);
      setPublicLyrics(song?.publicLyrics ?? false);
    } else if (songChoice?.kind === "new") {
      setPublicLyrics(false);
    }
  }, [songChoice, catalogSongs]);

  useEffect(() => {
    if (songChoice?.kind !== "existing") {
      setSongVersions((current) => (current.length === 0 ? current : []));
      return;
    }

    let active = true;
    repository
      .listChartsBySong(songChoice.songId)
      .then((charts) => {
        if (active) {
          setSongVersions(charts.map((chart) => chartVersionLabel(chart)));
        }
      })
      .catch(() => {
        if (active) {
          setSongVersions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [repository, songChoice]);

  const versionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const label of [...CHART_VERSION_PRESETS, ...songVersions, ...extraVersions]) {
      const trimmed = label.trim();
      const key = trimmed.toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push(trimmed);
    }
    return options;
  }, [extraVersions, songVersions]);

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
    setSelectedSongKey(nextDraft.song.defaultKey ?? nextDraft.chart.key);
    setSongChoice(undefined);
    setVersionLabel(PRINCIPAL_VERSION_LABEL);
    setExtraVersions([]);
    setSongVersions([]);
    setError(undefined);
  }

  function createVersion(label: string) {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }
    const existing = versionOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setVersionLabel(existing);
      return;
    }
    setExtraVersions((current) => [...current, trimmed]);
    setVersionLabel(trimmed);
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

  function selectNewSong(title: string, artist: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      if (songChoice?.kind === "new") setSongChoice(undefined);
      return;
    }

    const trimmedArtist = artist.trim();
    setSongChoice({
      kind: "new",
      title: trimmedTitle,
      ...(trimmedArtist ? { artist: trimmedArtist } : {}),
    });
  }

  async function save() {
    if (!draft || !selectedSongKey || !songChoice) return;

    setBusy(true);
    setError(undefined);
    try {
      const input: SaveImportedChartInput = {
        draft,
        selectedSongKey,
        song: songChoice,
        publicLyrics,
        versionLabel,
      };
      const result = await saveImportedChart(input, repository);
      onNavigate(`/songs/${result.song.id}`);
    } catch (cause) {
      if (cause instanceof RepositoryError && cause.code === "IMPORT_LOCKED") {
        setError("Sem permissão para importar.");
        return;
      }
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

  const tonalityOptions = TONALITY_OPTIONS.includes(selectedSongKey)
    ? TONALITY_OPTIONS
    : [selectedSongKey, ...TONALITY_OPTIONS].filter(Boolean);
  const canSave = Boolean(selectedSongKey && songChoice && !busy);

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

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <section className="px-3 py-3">
          <p className="ds-eyebrow mb-2">Música</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-content-muted">
              {draft.song.title || "Nova música"}
              {draft.song.artist ? ` · ${draft.song.artist}` : ""}
            </span>
          </div>
          <div className="mt-3">
            <PublicVisibilityField
              variant="pill"
              checked={publicLyrics}
              onChange={setPublicLyrics}
            />
          </div>
        </section>
        <section className="px-3 py-3">
          <p className="ds-eyebrow mb-2">Cifra</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-content px-3 py-1 text-xs font-semibold text-content-inverse">
              {draft.chart.format === "lyrics" ? "Cifra com letra" : "Grade por compassos"}
            </span>
            <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
              Compasso {draft.chart.timeSignature}
            </span>
            {draft.chart.capo ? (
              <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
                Capo {draft.chart.capo}ª
              </span>
            ) : null}
          </div>
        </section>
      </div>

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
        <div>
          <h2 className="text-xl font-semibold text-content">Versão da cifra</h2>
          <p className="mt-1 text-sm text-content-muted">
            Escolha Principal, Simplificada ou Letra, ou adicione uma tag para esta cifra.
          </p>
        </div>
        <ChartVersionField
          value={versionLabel}
          options={versionOptions}
          onChange={setVersionLabel}
          onCreate={createVersion}
        />
      </section>

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
              {SECTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
        <div>
          <label htmlFor="song-key" className="text-sm font-medium text-content-muted">
            Tom da música
          </label>
          <select
            id="song-key"
            aria-describedby="song-key-help"
            value={selectedSongKey}
            onChange={(event) => setSelectedSongKey(event.target.value)}
            className="ds-input mt-2"
          >
            {tonalityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span id="song-key-help" className="mt-2 block text-xs text-content-muted">
            Salvo apenas como registro da tonalidade da música; não altera a cifra importada.
          </span>
        </div>
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
              onChange={(event) => {
                const nextTitle = event.target.value;
                setNewSongTitle(nextTitle);
                selectNewSong(nextTitle, newSongArtist);
              }}
              className="ds-input mt-2"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-content-muted">Artista</span>
            <input
              value={newSongArtist}
              onChange={(event) => {
                const nextArtist = event.target.value;
                setNewSongArtist(nextArtist);
                selectNewSong(newSongTitle, nextArtist);
              }}
              className="ds-input mt-2"
            />
          </label>
        </div>
        {songChoice?.kind === "new" ? (
          <p role="status" className="text-sm font-medium text-primary">
            Esta nova música será criada ao salvar: {songChoice.title}
            {songChoice.artist ? ` · ${songChoice.artist}` : ""}
          </p>
        ) : null}
      </section>

      <button type="button" className="ds-button" disabled={!canSave} onClick={save}>
        Salvar cifra
      </button>
    </section>
  );
}
