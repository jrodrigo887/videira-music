"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { buildExampleCharts } from "@/lib/charts/example-charts";
import { IndexedDbMusicRepository } from "@/lib/persistence/music-database";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import type { ChordChart, Song } from "@/types/music";

type SongDetailProps = {
  songId: string;
  seedSong?: Song;
  repository?: MusicRepository;
};

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; song: Song; charts: ChordChart[]; storageWarning: boolean }
  | { status: "storage-error" };

export function SongDetail({
  songId,
  seedSong,
  repository: suppliedRepository,
}: SongDetailProps) {
  const repository = useMemo(
    () => suppliedRepository ?? new IndexedDbMusicRepository(),
    [suppliedRepository],
  );
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const song = seedSong ?? await repository.findSongById(songId);
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
            storageWarning: false,
          });
        }
      } catch {
        if (!active) return;
        if (seedSong) {
          setState({
            status: "ready",
            song: seedSong,
            charts: buildExampleCharts(seedSong),
            storageWarning: true,
          });
        } else {
          setState({ status: "storage-error" });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [repository, seedSong, songId]);

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
          Não foi possível consultar os dados locais. Tente novamente.
        </p>
        <Link href="/songs" className="ds-link mt-4 inline-block">Voltar para biblioteca</Link>
      </section>
    );
  }

  const persisted = state.charts.some((chart) => chart.id.startsWith("chart-local-") || chart.origin);

  return (
    <div className="space-y-8">
      <Link href="/songs" className="ds-link text-sm">
        Voltar para biblioteca
      </Link>

      {state.storageWarning ? (
        <p role="alert" className="ds-card-muted">
          Cifras locais não puderam ser carregadas. Exibindo o conteúdo inicial.
        </p>
      ) : null}

      <section className="ds-card">
        <p className="ds-eyebrow text-content-subtle">Detalhe da musica</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-content">{state.song.title}</h1>
            <p className="mt-2 text-content-muted">{state.song.meta}</p>
            {state.song.artist ? (
              <p className="mt-1 text-sm text-content-subtle">{state.song.artist}</p>
            ) : null}
          </div>
          {state.song.defaultKey ? (
            <span className="ds-badge px-4 py-2">Tom {state.song.defaultKey}</span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="ds-eyebrow">Cifras</p>
          <h2 className="mt-2 text-2xl font-bold text-content">
            {persisted ? "Cifras importadas" : "Cifras de exemplo"}
          </h2>
        </div>

        <div className="grid gap-6">
          {state.charts.map((chart) => (
            <div key={chart.id} className="space-y-2">
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
              <ChordChartPreview chart={chart} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
