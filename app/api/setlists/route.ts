import {
  InvalidJsonError,
  PayloadTooLargeError,
  persistenceError,
  readJsonBody,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
import {
  databaseNotConfiguredResponse,
  type SetlistRouteDependencies,
  createSetlistRouteDependencies,
} from "@/lib/setlists/setlist-route-deps";
import { mapSetlistFailure, withSetlistService } from "@/lib/setlists/setlist-api";
import { parseCreateSetlist } from "@/lib/setlists/validate-setlist-input";
import type { SetlistTab } from "@/lib/setlists/setlist-service";
import { SETLIST_BODY_LIMIT_BYTES } from "@/lib/setlists/setlist-body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: SetlistTab[] = ["team", "others", "organization", "following"];

function parseTab(value: string | null): SetlistTab {
  if (value && TABS.includes(value as SetlistTab)) {
    return value as SetlistTab;
  }
  return "team";
}

export function createSetlistsGetHandler(dependencies: SetlistRouteDependencies) {
  return async function get(request: Request): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }

    const url = new URL(request.url);
    const teamSlug = url.searchParams.get("team");
    const tab = parseTab(url.searchParams.get("tab"));

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      const teamService = await dependencies.getTeamService();
      const selectable = await teamService.teamsSelectableBy(actor);

      let currentTeam = selectable[0] ?? null;
      if (teamSlug) {
        const matched = selectable.find((entry) => entry.slug === teamSlug);
        if (matched) {
          currentTeam = matched;
        }
      }

      if (tab === "following") {
        if (!currentTeam) {
          return Response.json({ setlists: [] });
        }
        const setlists = await service.listTab(actor, { team: currentTeam, tab: "following" });
        return Response.json({ setlists });
      }

      if (tab === "organization" || !currentTeam) {
        const setlists = await service.listTab(actor, {
          team: currentTeam,
          tab: "organization",
        });
        return Response.json({ setlists });
      }

      const setlists = await service.listTab(actor, { team: currentTeam, tab });
      return Response.json({ setlists });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createSetlistsPostHandler(dependencies: SetlistRouteDependencies) {
  return async function post(request: Request): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }

    let body: unknown;
    try {
      body = await readJsonBody(request, SETLIST_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return persistenceError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.");
      }
      if (error instanceof InvalidJsonError) {
        return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
      }
      return mapSetlistFailure(error);
    }

    const parsed = parseCreateSetlist(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      const setlist = await service.create(actor, parsed.value);
      return Response.json({ setlist }, { status: 201 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const GET = wrapPersistenceRoute(
  { route: "/api/setlists", method: "GET", permission: "music:read" },
  createSetlistsGetHandler(routeDependencies),
);

export const POST = wrapPersistenceRoute(
  { route: "/api/setlists", method: "POST", permission: "setlists:led" },
  createSetlistsPostHandler(routeDependencies),
);
