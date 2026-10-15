import "server-only";

import { getCurrentActor } from "@/lib/auth/current-actor";
import { can } from "@/lib/auth/permissions";

import { isImportModuleFlagOn } from "./import-module-config";

export type ImportAccessState = "disabled" | "locked" | "allowed";

export async function canImport(_request: Request): Promise<ImportAccessState> {
  if (!isImportModuleFlagOn()) {
    return "disabled";
  }

  const actor = await getCurrentActor();
  if (actor.kind !== "user") {
    return "locked";
  }

  if (!can(actor, "import", { organizationId: actor.organizationId })) {
    return "locked";
  }

  return "allowed";
}

export async function canImportFromCookieHeader(
  _cookieHeader: string | null | undefined,
): Promise<ImportAccessState> {
  return canImport(new Request("http://import-access.local/"));
}
