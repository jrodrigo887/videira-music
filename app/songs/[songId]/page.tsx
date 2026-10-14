import { isImportModuleVisibleInUi } from "@/lib/import-access/import-module-config";

import { SongDetail } from "./song-detail";

type SongDetailPageProps = {
  params: Promise<{
    songId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { songId } = await params;
  return (
    <SongDetail songId={songId} importLinkVisible={isImportModuleVisibleInUi()} />
  );
}
