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
import { parseClone } from "@/lib/setlists/validate-setlist-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ setlistId: string }> };

export function createSetlistClonePostHandler(dependencies: SetlistRouteDependencies) {
  return async function post(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;

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

    const parsed = parseClone(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      const setlist = await service.clone(actor, setlistId, parsed.value);
      return Response.json({ setlist }, { status: 201 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const POST = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]/clone", method: "POST", permission: "music:read" },
  createSetlistClonePostHandler(routeDependencies),
);
