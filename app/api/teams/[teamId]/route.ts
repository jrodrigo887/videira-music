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

type RouteContext = { params: Promise<{ teamId: string }> };

type TeamPatchInput = { name: string } | { archived: true };

function parseTeamPatchBody(body: unknown): TeamPatchInput | Response {
  if (typeof body !== "object" || body === null) {
    return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
  }
  const record = body as Record<string, unknown>;
  if (record.archived === true) {
    return { archived: true };
  }
  if (typeof record.name === "string") {
    return { name: record.name };
  }
  return persistenceError(400, "INVALID_REQUEST", "Requisição inválida.", {
    issues: [{ path: "body", message: "Corpo inválido." }],
  });
}

export function createTeamPatchHandler(dependencies: SetlistRouteDependencies) {
  return async function patch(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { teamId } = await (context as RouteContext).params;

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

    const parsed = parseTeamPatchBody(body);
    if (parsed instanceof Response) {
      return parsed;
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getTeamService();
      const team =
        "archived" in parsed
          ? await service.archiveTeam(actor, teamId)
          : await service.renameTeam(actor, teamId, parsed.name);
      return Response.json({ team });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const PATCH = wrapPersistenceRoute(
  { route: "/api/teams/[teamId]", method: "PATCH" },
  createTeamPatchHandler(routeDependencies),
);
