import "server-only";

import { readSessionFromRequest, verifyImportSessionToken } from "./import-session";
import {
  getImportAdminSecret,
  isImportModuleConfigured,
  logImportAccessMisconfiguredOnce,
} from "./import-module-config";

export type ImportAccessState = "disabled" | "locked" | "allowed";

export function canImport(request: Request, now = Date.now()): ImportAccessState {
  if (!isImportModuleConfigured()) {
    logImportAccessMisconfiguredOnce();
    return "disabled";
  }

  const secret = getImportAdminSecret();
  if (!secret) {
    return "disabled";
  }

  const parsed = readSessionFromRequest(request);
  if (parsed.kind === "duplicate") {
    return "locked";
  }
  if (parsed.kind !== "present") {
    return "locked";
  }

  if (!verifyImportSessionToken(parsed.value, secret, now)) {
    return "locked";
  }

  return "allowed";
}

export function canImportFromCookieHeader(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): ImportAccessState {
  const request = new Request("http://import-access.local/", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return canImport(request, now);
}
