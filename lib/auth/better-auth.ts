import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getPrisma } from "@/lib/persistence/prisma-client";

import { completeOAuthSignIn, invalidateAuthSessions, validateUserInfo } from "./access-gate";
import { logAuthMisconfiguredOnce, readAuthEnvConfig } from "./auth-config";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const ONE_DAY_SECONDS = 60 * 60 * 24;

type AuthServer = ReturnType<typeof betterAuth>;
let authInstance: AuthServer | undefined;

export function getAuth(): AuthServer | undefined {
  if (authInstance) {
    return authInstance;
  }

  const config = readAuthEnvConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production") {
      logAuthMisconfiguredOnce();
    }
    return undefined;
  }

  const prisma = getPrisma();

  authInstance = betterAuth({
    secret: config.secret,
    baseURL: config.baseUrl,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: false },
    user: {
      modelName: "authUser",
      validateUserInfo: (data) => validateUserInfo(data),
    },
    session: {
      modelName: "authSession",
      expiresIn: THIRTY_DAYS_SECONDS,
      updateAge: ONE_DAY_SECONDS,
    },
    account: {
      modelName: "authAccount",
    },
    verification: {
      modelName: "authVerification",
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        disableImplicitSignUp: true,
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            const authUser = await prisma.authUser.findUnique({
              where: { id: session.userId },
            });
            if (!authUser) {
              return;
            }
            const outcome = await completeOAuthSignIn({
              id: authUser.id,
              email: authUser.email,
              name: authUser.name,
              image: authUser.image,
            });
            if (outcome === "invalid") {
              await invalidateAuthSessions(authUser.id);
            }
          },
        },
      },
    },
  }) as unknown as AuthServer;

  return authInstance;
}

export function resetAuthForTests(): void {
  authInstance = undefined;
}
