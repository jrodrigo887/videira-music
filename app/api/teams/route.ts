import {
  InvalidJsonError,
  PayloadTooLargeError,
  persistenceError,
  readJsonBody,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
import {
  createSetlistRouteDependencies,
  databaseNotConfiguredResponse,
  type SetlistRouteDependencies,
} from "@/lib/setlists/setlist-route-deps";
import { withSetlistService } from "@/lib/setlists/setlist-api";
import { SETLIST_BODY_LIMIT_BYTES } from "@/lib/setlists/setlist-body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTeamCreateBody(body: unknown): { name: string } | Response {
  if (typeof body !== "object" || body === null) {
    return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
  }
  const name = (body as { name?: unknown }).name;
  if (typeof name !== "string") {
    return persistenceError(400, "INVALID_REQUEST", "Requisição inválida.", {
      issues: [{ path: "name", message: "Nome inválido." }],
    });
  }
  return { name };
}

export function createTeamsGetHandler(dependencies: SetlistRouteDependencies) {
  return async function get(request: Request): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }

    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getTeamService();
      const teams = await service.listTeams(actor, { includeArchived });
      return Response.json({ teams });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createTeamsPostHandler(dependencies: SetlistRouteDependencies) {
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
      throw error;
    }

    const parsed = parseTeamCreateBody(body);
    if (parsed instanceof Response) {
      return parsed;
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getTeamService();
      const team = await service.createTeam(actor, parsed);
      return Response.json({ team }, { status: 201 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const GET = wrapPersistenceRoute(
  { route: "/api/teams", method: "GET", permission: "teams:manage" },
  createTeamsGetHandler(routeDependencies),
);

export const POST = wrapPersistenceRoute(
  { route: "/api/teams", method: "POST", permission: "teams:manage" },
  createTeamsPostHandler(routeDependencies),
);
