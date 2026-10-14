import Link from "next/link";

import { SongLibrary } from "@/components/songs/song-library";
import { isImportModuleVisibleInUi } from "@/lib/import-access/import-module-config";

export default function SongsPage() {
  const importLinkVisible = isImportModuleVisibleInUi();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ds-eyebrow mb-3">
            Biblioteca
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-content sm:text-4xl">
            Musicas do repertorio
          </h1>
          <p className="mt-3 max-w-2xl text-content-muted">
            Busque pelo catalogo e abra uma musica para ver metadados e previews
            transponiveis de cifra.
          </p>
        </div>
        {importLinkVisible ? (
          <Link href="/import" className="ds-button shrink-0">
            Importar cifra
          </Link>
        ) : null}
      </section>

      <SongLibrary />
    </div>
  );
}
