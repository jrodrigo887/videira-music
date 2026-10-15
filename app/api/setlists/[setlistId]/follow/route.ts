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
import { parseFollow } from "@/lib/setlists/validate-setlist-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ setlistId: string }> };

async function parseFollowBody(request: Request) {
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

export function createSetlistFollowPostHandler(dependencies: SetlistRouteDependencies) {
  return async function post(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;
    const body = await parseFollowBody(request);
    if (body instanceof Response) {
      return body;
    }

    const parsed = parseFollow(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      await service.follow(actor, setlistId, parsed.value);
      return new Response(null, { status: 204 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createSetlistFollowDeleteHandler(dependencies: SetlistRouteDependencies) {
  return async function del(request: Request, context?: unknown): Promise<Response> {
    if (!dependencies.isConfigured()) {
      return databaseNotConfiguredResponse();
    }
    const { setlistId } = await (context as RouteContext).params;
    const body = await parseFollowBody(request);
    if (body instanceof Response) {
      return body;
    }

    const parsed = parseFollow(body);
    if (!parsed.ok) {
      return persistenceError(400, parsed.code, "Requisição inválida.", { issues: parsed.issues });
    }

    const result = await withSetlistService(async () => {
      const actor = await dependencies.getActor();
      const service = await dependencies.getSetlistService();
      await service.unfollow(actor, setlistId, parsed.value);
      return new Response(null, { status: 204 });
    });

    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const routeDependencies = createSetlistRouteDependencies();

export const POST = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]/follow", method: "POST", permission: "music:read" },
  createSetlistFollowPostHandler(routeDependencies),
);

export const DELETE = wrapPersistenceRoute(
  { route: "/api/setlists/[setlistId]/follow", method: "DELETE", permission: "music:read" },
  createSetlistFollowDeleteHandler(routeDependencies),
);
