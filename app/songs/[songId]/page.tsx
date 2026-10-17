import { Suspense } from "react";

import { can } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { isImportModuleVisibleInUi } from "@/lib/import-access/import-module-config";

import { SongDetailPageClient } from "./song-detail-page-client";

type SongDetailPageProps = {
  params: Promise<{
    songId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { songId } = await params;
  const actor = await getCurrentActor();
  const canEditMusic =
    actor.kind === "user" &&
    can(actor, "music:write", { organizationId: actor.organizationId });
  const currentUserId = actor.kind === "user" ? actor.userId : undefined;

  return (
    <Suspense fallback={<p className="text-content-muted">Carregando música…</p>}>
      <SongDetailPageClient
        songId={songId}
        importLinkVisible={isImportModuleVisibleInUi()}
        canEditMusic={canEditMusic}
        currentUserId={currentUserId}
      />
    </Suspense>
  );
}
