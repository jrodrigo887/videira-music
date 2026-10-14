import type { ValidationIssue } from "./validate-persistence-input";

export type PersistenceErrorBody = {
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
    existingChartId?: string;
  };
};

export function persistenceError(
  status: number,
  code: string,
  message: string,
  extras?: { issues?: ValidationIssue[]; existingChartId?: string; headers?: HeadersInit },
): Response {
  const body: PersistenceErrorBody = {
    error: {
      code,
      message,
      ...(extras?.issues ? { issues: extras.issues } : {}),
      ...(extras?.existingChartId ? { existingChartId: extras.existingChartId } : {}),
    },
  };
  return Response.json(body, { status, headers: extras?.headers });
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError();
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  const text = new TextDecoder().decode(buffer);
  if (!text.trim()) {
    throw new InvalidJsonError();
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON");
    this.name = "InvalidJsonError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Payload too large");
    this.name = "PayloadTooLargeError";
  }
}

type RouteHandler = (request: Request, context?: unknown) => Promise<Response> | Response;

type PersistenceRouteMeta = {
  route: string;
  method: string;
};

export function withPersistenceRoute(meta: PersistenceRouteMeta, handler: RouteHandler): RouteHandler {
  void meta;
  return handler;
}

export function logPersistenceError(meta: {
  route: string;
  method: string;
  status: number;
  code: string;
  durationMs: number;
}): void {
  console.error(
    JSON.stringify({
      route: meta.route,
      method: meta.method,
      status: meta.status,
      code: meta.code,
      durationMs: meta.durationMs,
    }),
  );
}

export function wrapPersistenceRoute(
  meta: PersistenceRouteMeta,
  handler: RouteHandler,
): RouteHandler {
  return async (request: Request, context?: unknown) => {
    const started = Date.now();
    const response = await handler(request, context);
    if (response.status >= 400) {
      let code = "PERSISTENCE_FAILED";
      try {
        const clone = response.clone();
        const body = (await clone.json()) as PersistenceErrorBody;
        code = body.error?.code ?? code;
      } catch {
        // ignore parse errors
      }
      logPersistenceError({
        route: meta.route,
        method: meta.method,
        status: response.status,
        code,
        durationMs: Date.now() - started,
      });
    }
    return response;
  };
}

export {
  assertImportWriteAllowed,
  chartPayloadHasOrigin,
  gateChartWriteWithOrigin,
  recordFailedChartSave,
  recordSuccessfulChartSave,
} from "@/lib/import-access/chart-origin-gate";
