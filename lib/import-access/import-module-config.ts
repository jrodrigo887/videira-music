import "server-only";

import { MIN_ADMIN_SECRET_LENGTH } from "./constants";

let misconfiguredLogged = false;

export function isImportModuleFlagOn(): boolean {
  return process.env.VIDEIRA_ENABLE_IMPORT === "true";
}

export function getImportAdminSecret(): string | undefined {
  const secret = process.env.VIDEIRA_IMPORT_ADMIN_SECRET;
  if (!secret || secret.length < MIN_ADMIN_SECRET_LENGTH) {
    return undefined;
  }
  return secret;
}

export function isImportModuleConfigured(): boolean {
  return isImportModuleFlagOn() && getImportAdminSecret() !== undefined;
}

/** Links to `/import` are shown when the module is configured, even without a session. */
export function isImportModuleVisibleInUi(): boolean {
  return isImportModuleConfigured();
}

export function logImportAccessMisconfiguredOnce(): void {
  if (misconfiguredLogged || !isImportModuleFlagOn()) {
    return;
  }
  if (getImportAdminSecret() === undefined) {
    misconfiguredLogged = true;
    console.error(JSON.stringify({ code: "IMPORT_ACCESS_MISCONFIGURED" }));
  }
}

export function resetImportModuleConfigForTests(): void {
  misconfiguredLogged = false;
}
