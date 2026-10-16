import "server-only";

import { headers } from "next/headers";

import type { PrismaClient } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

import { ANONYMOUS_ACTOR, type Actor } from "./actor";
import { getAuth } from "./better-auth";
import { loadActorForAuthUserId, loadActorForUser } from "./load-actor";
import { resolveViewAsForActor } from "./resolve-view-as";
import { resolveSimulatedUserId } from "./simulated-auth";

async function effectiveActor(prisma: PrismaClient, actor: Actor): Promise<Actor> {
  if (actor.kind !== "user") {
    return actor;
  }
  return resolveViewAsForActor(prisma, actor);
}

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
    return effectiveActor(prisma, await loadActorForUser(prisma, simulatedUserId));
  }

  const auth = getAuth();
  if (!auth) {
    return ANONYMOUS_ACTOR;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return ANONYMOUS_ACTOR;
  }

  return effectiveActor(prisma, await loadActorForAuthUserId(prisma, session.user.id));
}
