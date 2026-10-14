import { notFound } from "next/navigation";

import { SetlistEditor } from "@/components/setlists/setlist-editor";
import { notFoundIfSetlistMissing } from "@/lib/setlists/setlist-not-found";
import { resolveSelectedTeam } from "@/lib/setlists/setlist-page-utils";
import { createSetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import type { Setlist } from "@/types/setlist";

export const dynamic = "force-dynamic";

type SetlistEditPageProps = {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export default async function SetlistEditPage({ params, searchParams }: SetlistEditPageProps) {
  const { setlistId } = await params;
  const { team: teamSlug } = await searchParams;
  const dependencies = createSetlistRouteDependencies();

  if (!dependencies.isConfigured()) {
    notFound();
  }

  const actor = await dependencies.getActor();
  const teamService = await dependencies.getTeamService();
  const setlistService = await dependencies.getSetlistService();

  let setlist: Setlist;
  try {
    setlist = await setlistService.getReadable(actor, setlistId);
  } catch (error) {
    notFoundIfSetlistMissing(error);
  }

  const selectableTeams = await teamService.teamsSelectableBy(actor);
  const selectedTeam = resolveSelectedTeam(selectableTeams, teamSlug);

  return <SetlistEditor setlist={setlist} teamQuery={selectedTeam?.slug} />;
}
