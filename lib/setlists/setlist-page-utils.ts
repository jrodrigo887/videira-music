import type { Actor } from "@/lib/auth/actor";
import type { WorshipTeam } from "@/types/identity";

import { canPerform } from "./setlist-policy";
import type { SetlistTab } from "./setlist-service";

export const SETLIST_TAB_OPTIONS: ReadonlyArray<{ id: SetlistTab; label: string }> = [
  { id: "team", label: "Do grupo" },
  { id: "others", label: "Outros grupos" },
  { id: "organization", label: "Da igreja" },
  { id: "following", label: "Seguindo" },
];

export function setlistTabLabel(
  entry: { id: SetlistTab; label: string },
  team: WorshipTeam | null,
): string {
  return entry.id === "team" && team ? team.name : entry.label;
}

export function parseSetlistTab(value: string | undefined): SetlistTab {
  if (value === "others" || value === "organization" || value === "following") {
    return value;
  }
  return "team";
}

export function resolveSelectedTeam(
  teams: WorshipTeam[],
  teamSlug: string | undefined,
): WorshipTeam | null {
  if (teams.length === 0) {
    return null;
  }
  if (teamSlug) {
    const match = teams.find((team) => team.slug === teamSlug);
    if (match) {
      return match;
    }
  }
  return teams[0] ?? null;
}

export function canCreateSetlistForContext(
  actor: Actor,
  organizationId: string,
  team: WorshipTeam | null,
): boolean {
  if (team && canPerform(actor, "create", { type: "destination", organizationId, teamId: team.id })) {
    return true;
  }
  return canPerform(actor, "create", { type: "destination", organizationId, teamId: null });
}

export function buildSetlistsQuery(team: WorshipTeam | null, tab: SetlistTab): string {
  const params = new URLSearchParams();
  if (team) {
    params.set("team", team.slug);
  }
  if (tab !== "team") {
    params.set("tab", tab);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
