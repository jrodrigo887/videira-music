"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { SetlistNeighborsNav } from "@/components/setlists/setlist-neighbors-nav";
import { ChartEditor } from "@/components/songs/chart-editor";
import { ChartHistoryPanel } from "@/components/songs/chart-history-panel";
import { ChartSuggestionPanel } from "@/components/songs/chart-suggestion-panel";
import { ChartDisplaySettingsPanel } from "@/components/songs/chart-display-settings-panel";
import { PublicVisibilityField } from "@/components/songs/public-visibility-field";
import { originalChart, songVersionTags } from "@/lib/charts/chart-versions";
import { buildExampleCharts } from "@/lib/charts/example-charts";
import { semitonesBetweenKeys, transposeChord } from "@/lib/chords/transpose-chord";
import { HttpMusicRepository } from "@/lib/persistence/http-music-repository";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import {
  readChartDisplay,
  writeChartDisplay,
  type ChartDisplaySettings,
} from "@/lib/songs/chart-display-preference";
import type { SetlistSongContext } from "@/lib/songs/setlist-song-context";
import {
  readTransposeSemitones,
  writeTransposeSemitones,
  type TransposePreferenceScope,
} from "@/lib/songs/transpose-preference";
import type { ChordChart, Song } from "@/types/music";

type SongDetailProps = {
  songId: string;
  importLinkVisible?: boolean;
  canEditMusic?: boolean;
  currentUserId?: string;
  repository?: MusicRepository;
  setlistContext?: SetlistSongContext;
};

function transposePreferenceScope(
  songId: string,
  setlistContext?: SetlistSongContext,
): TransposePreferenceScope {
  if (setlistContext) {
    return {
      kind: "setlist-item",
      setlistId: setlistContext.setlistId,
      itemId: setlistContext.setlistItemId,
    };
  }

  return { kind: "song", songId };
}

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; song: Song; charts: ChordChart[]; persistedCharts: boolean }
  | { status: "storage-error" };

function canEditChartContent(
  chart: ChordChart,
  canEditMusic: boolean,
  currentUserId?: string,
): boolean {
  if (canEditMusic) {
    return true;
  }
  return Boolean(currentUserId && chart.createdByUserId === currentUserId);
}

function chartSupportsLyricsEdit(
  chart: ChordChart,
  canEditMusic: boolean,
  persistedCharts: boolean,
  currentUserId?: string,
): boolean {
  return (
    canEditChartContent(chart, canEditMusic, currentUserId) &&
    persistedCharts &&
    chart.format === "lyrics" &&
    Boolean(chart.source?.trim())
  );
}

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-content-muted shadow-xs transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-border disabled:text-content-subtle disabled:opacity-40 disabled:hover:border-border disabled:hover:text-content-subtle";

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-current">
      <path
        d="M11.5 2.5a1.2 1.2 0 0 1 1.7 1.7L5.8 11.6 3 12.3l.7-2.8 7.4-7.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 4 12 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="text-current">
      <path
        d="M3 3h10v2H3V3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 5h8v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SongDetail({
  songId,
  importLinkVisible = false,
  canEditMusic = false,
  currentUserId,
  repository: suppliedRepository,
  setlistContext,
}: SongDetailProps) {
  const transposeScope = useMemo(
    () => transposePreferenceScope(songId, setlistContext),
    [songId, setlistContext],
  );
  const setlistSelectedKey = setlistContext?.selectedKey;
  const repository = useMemo(
    () => suppliedRepository ?? new HttpMusicRepository(),
    [suppliedRepository],
  );
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [semitones, setSemitones] = useState(0);
  const [transposePreferenceReady, setTransposePreferenceReady] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [columns, setColumns] = useState<1 | 2>(1);
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(readChartDisplay);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [publicLyrics, setPublicLyrics] = useState(false);
  const [publicLyricsDirty, setPublicLyricsDirty] = useState(false);
  const [publicLyricsSaving, setPublicLyricsSaving] = useState(false);
  const [publicLyricsError, setPublicLyricsError] = useState<string>();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);

  const updateDisplaySettings = useCallback((next: ChartDisplaySettings) => {
    setDisplaySettings(next);
    writeChartDisplay(next);
  }, []);

  const headerRef = useRef<HTMLElement | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    const element = headerRef.current;
    if (state.status !== "ready" || !element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeaderCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      // Altura aproximada do header principal (49px no mobile, 61px a partir de sm).
      {
        rootMargin: `-${window.innerWidth >= 640 ? 61 : 49}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [state.status]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const song = await repository.findSongById(songId);
        if (!song) {
          if (active) setState({ status: "missing" });
          return;
        }

        const persistedCharts = await repository.listChartsBySong(song.id);
        if (active) {
          setState({
            status: "ready",
            song,
            charts: persistedCharts.length ? persistedCharts : buildExampleCharts(song),
            persistedCharts: persistedCharts.length > 0,
          });
          setPublicLyrics(song.publicLyrics ?? false);
          setPublicLyricsDirty(false);
          setPublicLyricsError(undefined);
        }
      } catch {
        if (active) {
          setState({ status: "storage-error" });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [repository, songId, reloadToken]);

  useEffect(() => {
    if (state.status !== "ready") {
      setTransposePreferenceReady(false);
      return;
    }

    const baseKey =
      state.song.defaultKey ?? state.charts[0]?.key ?? "C";
    const saved = readTransposeSemitones(transposeScope);
    if (saved !== undefined) {
      setSemitones(saved);
    } else if (setlistSelectedKey) {
      setSemitones(semitonesBetweenKeys(baseKey, setlistSelectedKey));
    } else {
      setSemitones(0);
    }
    setTransposePreferenceReady(true);
  }, [
    setlistSelectedKey,
    state,
    transposeScope,
    reloadToken,
  ]);

  useEffect(() => {
    if (!transposePreferenceReady || state.status !== "ready") {
      return;
    }

    writeTransposeSemitones(transposeScope, semitones);
  }, [semitones, state.status, transposePreferenceReady, transposeScope]);

  if (state.status === "loading") {
    return <p className="text-content-muted">Carregando música…</p>;
  }

  if (state.status === "missing") {
    return (
      <section className="ds-card">
        <h1 className="text-2xl font-bold text-content">Música não encontrada</h1>
        <Link href="/songs" className="ds-link mt-4 inline-block">Voltar para biblioteca</Link>
      </section>
    );
  }

  if (state.status === "storage-error") {
    return (
      <section className="ds-card">
        <p role="alert" className="text-content-muted">
          Não foi possível carregar a música. Tente novamente.
        </p>
        <button type="button" className="ds-link mt-4 inline-block" onClick={reload}>
          Tentar novamente
        </button>
        <Link href="/songs" className="ds-link mt-4 ml-4 inline-block">Voltar para biblioteca</Link>
      </section>
    );
  }

  const baseKey = state.song.defaultKey ?? state.charts[0]?.key ?? "C";
  const activeKey = transposeChord(baseKey, semitones, { key: baseKey });
  const resourcesPanelId = "song-detail-resources";
  const versionTags = songVersionTags(state.charts);
  const selectedChart =
    state.charts.find((chart) => chart.id === selectedChartId) ?? originalChart(state.charts);
  const visibleCharts = state.persistedCharts
    ? selectedChart
      ? [selectedChart]
      : []
    : state.charts;

  function selectVersion(chartId: string) {
    setSelectedChartId(chartId);
    setEditingChartId(null);
    setResourcesOpen(false);
  }

  async function savePublicLyrics() {
    if (state.status !== "ready" || !state.persistedCharts) {
      return;
    }
    setPublicLyricsSaving(true);
    setPublicLyricsError(undefined);
    try {
      const nextSong = { ...state.song, publicLyrics };
      await repository.saveSong(nextSong);
      setState({ ...state, song: nextSong });
      setPublicLyricsDirty(false);
    } catch {
      setPublicLyricsError("Não foi possível salvar a visibilidade pública.");
    } finally {
      setPublicLyricsSaving(false);
    }
  }

  const resourcesContent = (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        <Link
          href="/songs"
          aria-label="Voltar para biblioteca"
          title="Voltar para biblioteca"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-content shadow-xs transition hover:border-primary hover:text-primary"
        >
          ‹
        </Link>
        {importLinkVisible ? (
          <Link
            href="/import"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-border bg-surface px-4 text-xs font-semibold text-content shadow-xs transition hover:border-primary hover:text-primary"
          >
            + Importar cifra
          </Link>
        ) : null}
      </div>

      {importLinkVisible ? (
        <Link
          href="/import"
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-surface px-4 text-xs font-semibold text-content shadow-xs transition hover:border-primary hover:text-primary lg:hidden"
          onClick={() => setResourcesOpen(false)}
        >
          + Importar cifra
        </Link>
      ) : null}

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <section className="px-3 py-3">
          <p className="ds-eyebrow mb-2">Música</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-content px-3 py-1 text-xs font-semibold text-content-inverse">
              Principal
            </span>
            <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-content-muted">
              {state.persistedCharts ? "Cifras importadas" : "Cifras de exemplo"}
            </span>
            {state.charts.length > 1 ? (
              <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-subtle">
                {state.charts.length} {state.persistedCharts ? "versões" : "formatos"}
              </span>
            ) : null}
          </div>
          {canEditMusic && state.persistedCharts ? (
            <div className="mt-3 space-y-2">
              <PublicVisibilityField
                variant="pill"
                checked={publicLyrics}
                onChange={(checked) => {
                  setPublicLyrics(checked);
                  setPublicLyricsDirty(true);
                }}
              />
              {publicLyricsError ? (
                <p role="alert" className="text-xs text-content-muted">
                  {publicLyricsError}
                </p>
              ) : null}
              {publicLyricsDirty ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary transition hover:underline"
                  disabled={publicLyricsSaving}
                  onClick={() => void savePublicLyrics()}
                >
                  {publicLyricsSaving ? "Salvando…" : "Salvar visibilidade"}
                </button>
              ) : null}
            </div>
          ) : null}
          {visibleCharts.some(
            (chart) =>
              chart.origin?.url ||
              chartSupportsLyricsEdit(chart, canEditMusic, state.persistedCharts, currentUserId),
          ) ? (
            <div className="mt-3 space-y-2.5">
              {visibleCharts.map((chart, chartIndex) => {
                const showEditControl = chartSupportsLyricsEdit(
                  chart,
                  canEditMusic,
                  state.persistedCharts,
                  currentUserId,
                );
                const originUrl = chart.origin?.url;
                if (!originUrl && !showEditControl) {
                  return null;
                }

                const chartLabel =
                  visibleCharts.length > 1
                    ? chart.title?.trim() || `Cifra ${chartIndex + 1}`
                    : null;

                return (
                  <div key={chart.id} className="space-y-2">
                    {chartLabel ? (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
                        {chartLabel}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      {originUrl ? (
                        <p className="min-w-0 text-xs leading-snug text-content-muted">
                          Importada do{" "}
                          <a
                            href={originUrl}
                            className="ds-link font-medium"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {chart.origin?.sourceName ?? "origem"}
                          </a>
                        </p>
                      ) : (
                        <span className="min-w-0 flex-1" />
                      )}
                      {showEditControl ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className={iconButtonClass}
                            aria-label="Editar cifra"
                            title="Editar cifra"
                            disabled={editingChartId !== null && editingChartId !== chart.id}
                            onClick={() => setEditingChartId(chart.id)}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            className={iconButtonClass}
                            aria-label="Arquivar cifra"
                            title="Arquivar cifra (em breve)"
                            disabled
                          >
                            <ArchiveIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {editingChartId === chart.id ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-content-muted transition hover:text-content"
                        onClick={() => setEditingChartId(null)}
                      >
                        Fechar editor
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {visibleCharts.map((chart, chartIndex) => {
          const chartSectionLabel =
            visibleCharts.length > 1
              ? (chart.title?.trim() || `Cifra ${chartIndex + 1}`)
              : "Cifra";

          return (
            <section key={chart.id} className="px-3 py-3">
              <p className="ds-eyebrow mb-2">{chartSectionLabel}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-content px-3 py-1 text-xs font-semibold text-content-inverse">
                  {chart.format === "lyrics" ? "Cifra com letra" : "Grade por compassos"}
                </span>
                <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
                  Compasso {chart.timeSignature}
                </span>
                {chart.capo ? (
                  <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
                    Capo {chart.capo}ª
                  </span>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setColumns((current) => (current === 1 ? 2 : 1))}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-content transition hover:bg-surface-muted/60"
        >
          <span className="font-semibold">Dividir em colunas</span>
          <span className="text-content-subtle">{columns === 2 ? "2 col." : "1 col."} ›</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDiagrams((current) => !current)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-content transition hover:bg-surface-muted/60"
        >
          <span className="font-semibold">Diagramas</span>
          <span className="text-content-subtle">{showDiagrams ? "Violão" : "Oculto"} ›</span>
        </button>

        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="font-semibold text-content">Tom</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Diminuir meio-tom"
              onClick={() => setSemitones((value) => value - 1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-content-muted transition hover:border-primary hover:text-primary"
            >
              −
            </button>
            <span className="min-w-6 text-center font-bold text-primary">
              {activeKey}
            </span>
            <button
              type="button"
              aria-label="Aumentar meio-tom"
              onClick={() => setSemitones((value) => value + 1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-content-muted transition hover:border-primary hover:text-primary"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <span className="font-semibold text-content">Capotraste</span>
          <span className="text-content-subtle">Sem capotraste</span>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <span className="font-semibold text-content">Afinação</span>
          <span className="text-content-subtle">Padrão</span>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <ChartDisplaySettingsPanel value={displaySettings} onChange={updateDisplaySettings} />

        {semitones !== 0 ? (
          <button
            type="button"
            onClick={() => setSemitones(0)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-primary transition hover:bg-primary-subtle/50"
          >
            <span>Restaurar tom original</span>
            <span>{baseKey}</span>
          </button>
        ) : null}
      </div>

      {state.persistedCharts && selectedChart ? (
        <div className="space-y-3">
          <ChartHistoryPanel
            chartId={selectedChart.id}
            songTitle={state.song.title}
            versionLabel={selectedChart.versionLabel}
            versions={versionTags}
            canEdit={canEditChartContent(selectedChart, canEditMusic, currentUserId)}
            onRestored={reload}
            onSelectVersion={selectVersion}
          />
          <ChartSuggestionPanel
            chartId={selectedChart.id}
            canReview={canEditMusic}
            canSuggest={!canEditChartContent(selectedChart, canEditMusic, currentUserId)}
            onChanged={reload}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="min-w-0 max-w-full space-y-2 overflow-x-clip lg:space-y-4">
      <div
        aria-hidden={!headerCollapsed}
        className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/95 backdrop-blur transition duration-200 ${
          headerCollapsed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:py-3.5">
          <Link
            href="/songs"
            aria-label="Voltar para biblioteca"
            tabIndex={headerCollapsed ? 0 : -1}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content transition hover:border-primary hover:text-primary"
          >
            ‹
          </Link>
          <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
            <p className="truncate text-sm font-extrabold leading-tight tracking-tight text-content sm:text-lg">
              {state.song.title}
            </p>
            {state.song.artist ? (
              <p className="truncate text-xs font-bold leading-tight text-primary sm:text-sm">
                {state.song.artist}
              </p>
            ) : null}
          </div>
          {state.song.defaultKey ? (
            <span className="shrink-0 rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">
              Tom {activeKey}
            </span>
          ) : null}
          <button
            type="button"
            tabIndex={headerCollapsed ? 0 : -1}
            aria-controls={resourcesPanelId}
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen(true)}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-content transition hover:border-primary hover:text-primary lg:hidden"
          >
            Recursos
          </button>
        </div>
      </div>

      <header
        ref={headerRef}
        className="border-b border-border bg-canvas/95 px-4 py-2.5 lg:rounded-2xl lg:border lg:bg-surface lg:px-5 lg:py-4 lg:shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <Link
            href="/songs"
            aria-label="Voltar para biblioteca"
            title="Voltar para biblioteca"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content shadow-xs transition hover:border-primary hover:text-primary lg:hidden"
          >
            ‹
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-base font-extrabold tracking-tight text-content lg:text-3xl">
                {state.song.title}
              </h1>
              <span
                aria-hidden="true"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground lg:h-5 lg:w-5 lg:text-[11px]"
              >
                ✓
              </span>
            </div>
            {state.song.artist ? (
              <p className="truncate text-xs font-bold text-primary lg:mt-1 lg:text-lg">
                {state.song.artist}
              </p>
            ) : null}
          </div>
          {state.song.defaultKey ? (
            <span className="hidden shrink-0 rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary sm:inline-flex lg:px-4 lg:py-1.5 lg:text-sm">
              Tom {state.song.defaultKey}
            </span>
          ) : null}
          <button
            type="button"
            aria-controls={resourcesPanelId}
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-content shadow-xs transition hover:border-primary hover:text-primary lg:hidden"
          >
            Recursos
          </button>
        </div>
        {state.song.meta ? (
          <p className="mt-2 hidden text-sm text-content-muted lg:block">{state.song.meta}</p>
        ) : null}
      </header>

      {resourcesOpen ? (
        <div className="fixed inset-0 z-50 bg-content/35 backdrop-blur-sm lg:hidden">
          <div
            id={resourcesPanelId}
            role="dialog"
            aria-modal="true"
            aria-label="Recursos da cifra"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-border bg-canvas p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Recursos
                </p>
                <p className="text-sm font-bold text-content">{state.song.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setResourcesOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-content shadow-xs transition hover:border-primary hover:text-primary"
                aria-label="Fechar recursos"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">{resourcesContent}</div>
          </div>
        </div>
      ) : null}

      <div className="grid w-full min-w-0 max-w-full gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        <aside className="hidden space-y-3 lg:sticky lg:top-24 lg:block">
          {resourcesContent}
        </aside>

        <article className="ds-card min-w-0 w-full max-w-full overflow-x-hidden rounded-none border-x-0 p-3 sm:rounded-2xl sm:border sm:p-8">
          {visibleCharts.map((chart, index) => {
            return (
              <div
                key={chart.id}
                className={
                  index === 0
                    ? "space-y-3"
                    : "mt-6 space-y-3 border-t border-border pt-6 sm:mt-8 sm:pt-8"
                }
              >
                {editingChartId === chart.id ? (
                  <ChartEditor
                    chart={chart}
                    repository={repository}
                    onCancel={() => setEditingChartId(null)}
                    onSaved={() => {
                      setEditingChartId(null);
                      reload();
                    }}
                  />
                ) : (
                  <ChordChartPreview
                    chart={chart}
                    layout="embedded"
                    semitones={semitones}
                    onSemitonesChange={setSemitones}
                    syncDisplayKeyBase={baseKey}
                    showTransposeControls={false}
                    showDiagrams={showDiagrams}
                    columns={columns}
                    displaySettings={displaySettings}
                  />
                )}
              </div>
            );
          })}

          {setlistContext ? <SetlistNeighborsNav setlistContext={setlistContext} /> : null}
        </article>
      </div>
    </div>
  );
}
