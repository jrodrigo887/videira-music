import { NoAccess } from "@/components/auth/no-access";
import { SongTrashList } from "@/components/songs/song-trash-list";
import { can } from "@/lib/auth/permissions";
import { requirePageActor } from "@/lib/auth/page-gate";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { listTrashedSongs } from "@/lib/songs/song-trash-service";

export const dynamic = "force-dynamic";

export default async function SongTrashPage() {
  if (!isDatabaseConfigured()) {
    return (
      <section className="ds-card">
        <p className="text-content-muted">Banco de dados não configurado.</p>
      </section>
    );
  }

  const actor = await requirePageActor("/musicas/lixeira");
  if (!can(actor, "music:delete", { organizationId: actor.organizationId })) {
    return <NoAccess />;
  }

  const prisma = getPrisma();
  const songs = await listTrashedSongs(prisma, actor.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <p className="ds-eyebrow">Biblioteca</p>
        <h1 className="text-3xl font-bold tracking-tight text-content">Lixeira de músicas</h1>
        <p className="mt-2 text-content-muted">Músicas removidas da biblioteca podem ser restauradas aqui.</p>
      </div>
      <SongTrashList songs={songs} />
    </div>
  );
}
