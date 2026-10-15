import "server-only";

import { normalizeEmail } from "./email";

let misconfiguredLogged = false;

export type AuthEnvConfig = {
  secret: string;
  baseUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  bootstrapAdminEmail?: string;
};

export function readAuthEnvConfig(): AuthEnvConfig | undefined {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseUrl = process.env.BETTER_AUTH_URL;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret || !baseUrl || !googleClientId || !googleClientSecret) {
    return undefined;
  }
  const bootstrap = process.env.VIDEIRA_BOOTSTRAP_ADMIN_EMAIL?.trim();
  return {
    secret,
    baseUrl,
    googleClientId,
    googleClientSecret,
    ...(bootstrap ? { bootstrapAdminEmail: normalizeEmail(bootstrap) } : {}),
  };
}

export function isAuthConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return readAuthEnvConfig() !== undefined;
  }
  return readAuthEnvConfig() !== undefined;
}

export function isAuthConfiguredForProduction(): boolean {
  return process.env.NODE_ENV === "production" && readAuthEnvConfig() !== undefined;
}

export function logAuthMisconfiguredOnce(): void {
  if (misconfiguredLogged || process.env.NODE_ENV !== "production") {
    return;
  }
  if (readAuthEnvConfig() === undefined) {
    misconfiguredLogged = true;
    console.error(JSON.stringify({ code: "AUTH_MISCONFIGURED" }));
  }
}

export function resetAuthConfigForTests(): void {
  misconfiguredLogged = false;
}
