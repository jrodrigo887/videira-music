import "server-only";

let misconfiguredLogged = false;

export function isImportModuleFlagOn(): boolean {
  return process.env.VIDEIRA_ENABLE_IMPORT === "true";
}

/** Import feature is available when the flag is on (access is enforced by auth). */
export function isImportModuleConfigured(): boolean {
  return isImportModuleFlagOn();
}

export function isImportModuleVisibleInUi(): boolean {
  return isImportModuleFlagOn();
}

/** Playwright preview por URL fica só fora de produção (import local / dev). */
export function isCifraClubUrlImportEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function logImportAccessMisconfiguredOnce(): void {
  if (misconfiguredLogged) {
    return;
  }
  misconfiguredLogged = true;
}

export function resetImportModuleConfigForTests(): void {
  misconfiguredLogged = false;
}
