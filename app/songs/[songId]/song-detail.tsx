"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { buildExampleCharts } from "@/lib/charts/example-charts";
import { semitonesBetweenKeys, transposeChord } from "@/lib/chords/transpose-chord";
import { HttpMusicRepository } from "@/lib/persistence/http-music-repository";
import type { MusicRepository } from "@/lib/persistence/music-repository";
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

const FONT_SIZE_STEPS = [90, 100, 110, 120];

export function SongDetail({
  songId,
  importLinkVisible = false,
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
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [columns, setColumns] = useState<1 | 2>(1);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);

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
  const fontSizePercent = FONT_SIZE_STEPS[fontSizeIndex] ?? 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-3 lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
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
                    {state.charts.length} formatos
                  </span>
                ) : null}
              </div>
            </section>

            {state.charts.map((chart, chartIndex) => {
              const chartSectionLabel =
                state.charts.length > 1
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
            <button
              type="button"
              onClick={() => setFontSizeIndex((current) => (current + 1) % FONT_SIZE_STEPS.length)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-content transition hover:bg-surface-muted/60"
            >
              <span className="font-semibold">Texto</span>
              <span className="text-content-subtle">{fontSizePercent}% ›</span>
            </button>

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
        </aside>

        <article className="ds-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-extrabold tracking-tight text-content sm:text-4xl">
                  {state.song.title}
                </h1>
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                >
                  ✓
                </span>
              </div>

              {state.song.artist ? (
                <p className="mt-1 text-lg font-bold text-primary">
                  {state.song.artist}
                </p>
              ) : null}

              {state.song.meta ? (
                <p className="mt-1 text-sm text-content-muted">{state.song.meta}</p>
              ) : null}
            </div>

            {state.song.defaultKey ? (
              <span className="ds-badge px-4 py-1.5 text-sm">
                Tom {state.song.defaultKey}
              </span>
            ) : null}
          </div>

          {state.charts.map((chart, index) => (
            <div
              key={chart.id}
              className={
                index === 0
                  ? "mt-6 space-y-3 border-t border-border pt-6"
                  : "mt-8 space-y-3 border-t border-border pt-8"
              }
            >
              {chart.origin?.url ? (
                <p className="text-sm text-content-muted">
                  Fonte:{" "}
                  <a
                    href={chart.origin.url}
                    className="ds-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {chart.origin.sourceName ?? "Origem"}
                  </a>
                </p>
              ) : null}
              <ChordChartPreview
                chart={chart}
                layout="embedded"
                semitones={semitones}
                onSemitonesChange={setSemitones}
                syncDisplayKeyBase={baseKey}
                showTransposeControls
                showDiagrams={showDiagrams}
                columns={columns}
                fontSizePercent={fontSizePercent}
              />
            </div>
          ))}
        </article>
      </div>
    </div>
  );
}
