import { Suspense } from "react";

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
  return (
    <Suspense fallback={<p className="text-content-muted">Carregando música…</p>}>
      <SongDetailPageClient
        songId={songId}
        importLinkVisible={isImportModuleVisibleInUi()}
      />
    </Suspense>
  );
}
