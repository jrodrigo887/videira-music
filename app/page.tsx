import Link from "next/link";

import { listSongs } from "@/lib/data/songs";

export default function Home() {
  const songs = listSongs();

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <section>
        <p className="ds-badge-accent mb-4">
          MVP inicial
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-content sm:text-6xl">
          Cifras, transposicao e repertorios para a equipe de louvor.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-content-muted">
          O Videira Music comeca com uma biblioteca simples alimentada pelo catalogo existente,
          previews de cifra com letra e grade por compassos, e transposicao rapida.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/songs"
            className="ds-button"
          >
            Abrir biblioteca
          </Link>
          <Link
            href="/setlists"
            className="ds-button-secondary"
          >
            Ver setlists
          </Link>
        </div>
      </section>

      <aside className="ds-card">
        <p className="ds-eyebrow text-content-subtle">Catalogo seed</p>
        <strong className="mt-3 block text-5xl text-content">{songs.length}</strong>
        <p className="mt-2 text-content-muted">musicas carregadas de `data/musicas.json`.</p>
        <div className="ds-card-muted mt-6 text-sm">
          Proxima evolucao: persistencia local de setlists, rascunhos de cifras e modo leitura sequencial.
        </div>
      </aside>
    </div>
  );
}
