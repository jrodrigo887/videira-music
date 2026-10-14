import "server-only";

import { ensureSqlitePragmas, getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

import { ANONYMOUS_ACTOR, type Actor } from "./actor";
import { loadActorForUser } from "./load-actor";
import { resolveSimulatedUserId } from "./simulated-auth";

/**
 * Ponto único de identificação da requisição. Hoje usa o usuário simulado;
 * a autenticação real substitui só esta função.
 */
export async function getCurrentActor(): Promise<Actor> {
  const userId = resolveSimulatedUserId();
  if (!userId || !isDatabaseConfigured()) {
    return ANONYMOUS_ACTOR;
  }
  const prisma = getPrisma();
  await ensureSqlitePragmas(prisma);
  return loadActorForUser(prisma, userId);
}
