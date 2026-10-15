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
import { parseDelete, parseUpdateSetlist } from "@/lib/setlists/validate-setlist-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ setlistId: string }> };

async function readSetlistBody(request: Request): Promise<unknown | Response> {
  try {
    return await readJsonBody(request, SETLIST_BODY_LIMIT_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return persistenceError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.");
    }
    if (error instanceof InvalidJsonError) {
      return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
    }
    throw error;
  }
}

export function createSetlistDetailGetHandler(dependencies: SetlistRouteDependencies) {
  return async function get(_request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      const setlist = await service.getReadable(actor, setlistId);
      return Response.json({ setlist });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createSetlistDetailPatchHandler(dependencies: SetlistRouteDependencies) {
  return async function patch(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;
    const body = await readSetlistBody(request);
    if (body instanceof Response) {
      return body;
    }

    const parsed = parseUpdateSetlist(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      const setlist = await service.updateMeta(actor, setlistId, parsed.value);
      return Response.json({ setlist });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createSetlistDetailDeleteHandler(dependencies: SetlistRouteDependencies) {
  return async function del(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;
    const body = await readSetlistBody(request);
    if (body instanceof Response) {
      return body;
    }

    const parsed = parseDelete(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      await service.delete(actor, setlistId, parsed.value);
      return new Response(null, { status: 204 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const GET = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]", method: "GET", permission: "music:read" },
  createSetlistDetailGetHandler(routeDependencies),
);

export const PATCH = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]", method: "PATCH", permission: "music:read" },
  createSetlistDetailPatchHandler(routeDependencies),
);

export const DELETE = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]", method: "DELETE", permission: "music:read" },
  createSetlistDetailDeleteHandler(routeDependencies),
);
