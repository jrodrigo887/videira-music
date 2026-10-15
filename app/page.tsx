import Link from "next/link";

import { getCurrentActor } from "@/lib/auth/current-actor";
import { ensureSqlitePragmas, getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { listPublicSongs } from "@/lib/public-lyrics/public-lyrics";
import { can } from "@/lib/auth/permissions";

export default async function Home() {
  const actor = await getCurrentActor();

  if (actor.kind === "user") {
    return (
      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
        <section className="ds-card p-8 sm:p-10">
          <p className="ds-badge mb-4">Videira Music</p>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-content sm:text-5xl">
            Cifras, transposição e repertórios para a equipe de louvor.
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/songs" className="ds-button">
              Abrir biblioteca
            </Link>
            {can(actor, "import", { organizationId: actor.organizationId }) ? (
              <Link href="/import" className="ds-button-secondary">
                Importar cifra
              </Link>
            ) : null}
            <Link href="/setlists" className="ds-button-secondary">
              Ver setlists
            </Link>
          </div>
        </section>
      </div>
    );
  }

  let publicSongs: Awaited<ReturnType<typeof listPublicSongs>> = [];
  if (isDatabaseConfigured()) {
    const prisma = getPrisma();
    await ensureSqlitePragmas(prisma);
    publicSongs = await listPublicSongs(prisma);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content">Letras públicas</h1>
          <p className="mt-1 text-sm text-content-muted">
            Músicas que a igreja liberou para leitura sem login. As cifras ficam só para membros.
          </p>
        </div>
        <Link href="/entrar" className="ds-button">
          Entrar
        </Link>
      </header>
      {publicSongs.length === 0 ? (
        <p className="text-sm text-content-muted">Nenhuma letra pública no momento.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {publicSongs.map((song) => (
            <li key={song.id}>
              <Link
                href={`/letras/${song.id}`}
                className="ds-card block p-4 transition hover:border-primary"
              >
                <span className="font-semibold text-content">{song.title}</span>
                {song.artist ? (
                  <span className="mt-1 block text-sm text-content-muted">{song.artist}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
