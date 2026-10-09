import Link from "next/link";

import { listSongs } from "@/lib/data/songs";

export default function Home() {
  const songs = listSongs();

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <section>
        <p className="mb-4 inline-flex rounded-full bg-leaf-50 px-3 py-1 text-sm font-semibold text-leaf-700">
          MVP inicial
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          Cifras, transposicao e repertorios para a equipe de louvor.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          O Videira Music comeca com uma biblioteca simples alimentada pelo catalogo existente,
          previews de cifra com letra e grade por compassos, e transposicao rapida.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/songs"
            className="rounded-full bg-leaf-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-900"
          >
            Abrir biblioteca
          </Link>
          <Link
            href="/setlists"
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-leaf-500 hover:text-leaf-700"
          >
            Ver setlists
          </Link>
        </div>
      </section>

      <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Catalogo seed</p>
        <strong className="mt-3 block text-5xl text-slate-950">{songs.length}</strong>
        <p className="mt-2 text-slate-600">musicas carregadas de `data/musicas.json`.</p>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          Proxima evolucao: persistencia local de setlists, rascunhos de cifras e modo leitura sequencial.
        </div>
      </aside>
    </div>
  );
}
