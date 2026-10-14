import Link from "next/link";

import { listSongs } from "@/lib/data/songs";
import { isImportModuleVisibleInUi } from "@/lib/import-access/import-module-config";

export default function Home() {
  const songs = listSongs();
  const importLinkVisible = isImportModuleVisibleInUi();

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
      <section className="ds-card p-8 sm:p-10">
        <p className="ds-badge mb-4">
          MVP inicial
        </p>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-content sm:text-5xl">
          Cifras, transposicao e repertorios para a equipe de louvor.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-content-muted sm:text-lg">
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
          {importLinkVisible ? (
            <Link
              href="/import"
              className="ds-button-secondary"
            >
              Importar cifra
            </Link>
          ) : null}
          <Link
            href="/setlists"
            className="ds-button-secondary"
          >
            Ver setlists
          </Link>
        </div>
      </section>

      <aside className="ds-card p-8">
        <p className="ds-eyebrow">Catalogo seed</p>
        <strong className="mt-3 block text-5xl font-extrabold text-primary">{songs.length}</strong>
        <p className="mt-2 text-sm text-content-muted">musicas servidas pelo SQLite no servidor.</p>
        <div className="ds-card-muted mt-6 text-sm">
          Proxima evolucao: setlists, modo leitura sequencial e autenticacao multi-igreja.
        </div>
      </aside>
    </div>
  );
}
