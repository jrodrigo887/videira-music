import {
  clearImportSessionCookieHeader,
  createImportSessionToken,
  importSessionCookieHeader,
} from "@/lib/import-access/import-session";
import { importAccessError, sessionRouteHeaders } from "@/lib/import-access/import-access-http";
import { canImport } from "@/lib/import-access/import-access-policy";
import { getImportAdminSecret } from "@/lib/import-access/import-module-config";
import { recordImportLog } from "@/lib/import-access/import-log";
import { secretsMatch } from "@/lib/import-access/secret-compare";
import { resolveClientIp } from "@/lib/import-access/client-ip";
import { getUnlockRateLimiter } from "@/lib/import-access/unlock-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionRouteDependencies = {
  canImport(request: Request): ReturnType<typeof canImport>;
  getSecret(): string | undefined;
  rateLimiter: ReturnType<typeof getUnlockRateLimiter>;
  now(): number;
};

function parseUnlockBody(body: unknown): { ok: true; secret: string } | { ok: false } {
  if (typeof body !== "object" || body === null) {
    return { ok: false };
  }
  const secret = (body as Record<string, unknown>).secret;
  if (typeof secret !== "string" || secret.length === 0 || secret.length > 256) {
    return { ok: false };
  }
  return { ok: true, secret };
}

export function createSessionPostHandler(dependencies: SessionRouteDependencies) {
  return async function post(request: Request): Promise<Response> {
    if (dependencies.canImport(request) === "disabled") {
      return importAccessError(404, "NOT_FOUND", "Recurso não encontrado.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return importAccessError(400, "INVALID_REQUEST", "JSON inválido.");
    }

    const parsed = parseUnlockBody(body);
    if (!parsed.ok) {
      return importAccessError(400, "INVALID_REQUEST", "Corpo inválido.");
    }

    const ip = resolveClientIp(request);
    const now = dependencies.now();
    const limit = dependencies.rateLimiter.check(ip, now);
    if (!limit.allowed) {
      await recordImportLog({ action: "unlock", outcome: "TOO_MANY_ATTEMPTS" });
      return importAccessError(429, "TOO_MANY_ATTEMPTS", "Muitas tentativas.", {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    const configured = dependencies.getSecret();
    if (!configured || !secretsMatch(parsed.secret, configured)) {
      dependencies.rateLimiter.recordFailure(ip, now);
      await recordImportLog({ action: "unlock", outcome: "INVALID_SECRET" });
      return importAccessError(401, "INVALID_SECRET", "Segredo inválido.");
    }

    dependencies.rateLimiter.resetIp(ip);
    const token = createImportSessionToken(configured, now);
    await recordImportLog({ action: "unlock", outcome: "success" });

    return new Response(null, {
      status: 204,
      headers: sessionRouteHeaders({
        "Set-Cookie": importSessionCookieHeader(token),
      }),
    });
  };
}

export function createSessionDeleteHandler(dependencies: Pick<SessionRouteDependencies, "canImport">) {
  return async function del(request: Request): Promise<Response> {
    if (dependencies.canImport(request) === "disabled") {
      return importAccessError(404, "NOT_FOUND", "Recurso não encontrado.");
    }

    await recordImportLog({ action: "logout", outcome: "success" });

    return new Response(null, {
      status: 204,
      headers: sessionRouteHeaders({
        "Set-Cookie": clearImportSessionCookieHeader(),
      }),
    });
  };
}

const defaultDependencies: SessionRouteDependencies = {
  canImport,
  getSecret: getImportAdminSecret,
  rateLimiter: getUnlockRateLimiter(),
  now: () => Date.now(),
};

export const POST = createSessionPostHandler(defaultDependencies);
export const DELETE = createSessionDeleteHandler(defaultDependencies);
