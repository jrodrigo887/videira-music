import type { ImportAccessState } from "./import-access-policy";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function importAccessError(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

export function importAccessDeniedResponse(state: ImportAccessState): Response | undefined {
  if (state === "disabled") {
    return importAccessError(404, "NOT_FOUND", "Recurso não encontrado.");
  }
  if (state === "locked") {
    return importAccessError(401, "IMPORT_LOCKED", "Import bloqueado.");
  }
  return undefined;
}

export function sessionRouteHeaders(extra?: HeadersInit): HeadersInit {
  return { ...NO_STORE, ...extra };
}
