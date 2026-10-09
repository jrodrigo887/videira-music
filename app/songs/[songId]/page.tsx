import Link from "next/link";
import { notFound } from "next/navigation";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { buildExampleCharts } from "@/lib/charts/example-charts";
import { findSongById, listSongs } from "@/lib/data/songs";

type SongDetailPageProps = {
  params: Promise<{
    songId: string;
  }>;
};

export function generateStaticParams() {
  return listSongs().map((song) => ({
    songId: song.id,
  }));
}

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { songId } = await params;
  const song = findSongById(songId);

  if (!song) {
    notFound();
  }

  const charts = buildExampleCharts(song);

  return (
    <div className="space-y-8">
      <Link href="/songs" className="text-sm font-semibold text-leaf-700 transition hover:text-leaf-900">
        Voltar para biblioteca
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalhe da musica</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{song.title}</h1>
            <p className="mt-2 text-slate-600">{song.meta}</p>
            {song.artist ? <p className="mt-1 text-sm text-slate-500">{song.artist}</p> : null}
          </div>
          {song.defaultKey ? (
            <span className="w-fit rounded-full bg-leaf-50 px-4 py-2 text-sm font-semibold text-leaf-700">
              Tom {song.defaultKey}
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-leaf-700">Previews</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Cifras de exemplo</h2>
          <p className="mt-2 text-slate-600">
            Conteudo demonstrativo para validar parsing, renderizacao e transposicao no MVP.
          </p>
        </div>

        <div className="grid gap-6">
          {charts.map((chart) => (
            <ChordChartPreview key={chart.id} chart={chart} />
          ))}
        </div>
      </section>
    </div>
  );
}
