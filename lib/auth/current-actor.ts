import "server-only";

import { headers } from "next/headers";

import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

import { ANONYMOUS_ACTOR, type Actor } from "./actor";
import { getAuth } from "./better-auth";
import { loadActorForAuthUserId, loadActorForUser } from "./load-actor";
import { resolveSimulatedUserId } from "./simulated-auth";

/**
 * Ponto único de identificação da requisição (AD-007).
 * Fora de produção, `VIDEIRA_SIMULATED_USER_ID` vence a sessão real.
 * `DEV_LOCALHOST=false` desliga o usuário simulado. `DEV_LOCALHOST=true` também libera o proxy.
 */
export async function getCurrentActor(): Promise<Actor> {
  if (!isDatabaseConfigured()) {
    return ANONYMOUS_ACTOR;
  }

  const simulatedUserId =
    process.env.NODE_ENV !== "production" ? resolveSimulatedUserId() : undefined;
  const prisma = getPrisma();

  if (simulatedUserId) {
    return loadActorForUser(prisma, simulatedUserId);
  }

  const auth = getAuth();
  if (!auth) {
    return ANONYMOUS_ACTOR;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return ANONYMOUS_ACTOR;
  }

  return loadActorForAuthUserId(prisma, session.user.id);
}
