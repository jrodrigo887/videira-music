import type { PrismaClient } from "@prisma/client";

import type { Actor, UserActor } from "./actor";
import { loadActorForUser } from "./load-actor";

async function endViewAsSession(
  prisma: PrismaClient,
  sessionId: string,
  actorUserId: string,
  endedAt: Date,
): Promise<void> {
  await prisma.viewAsSession.update({
    where: { id: sessionId },
    data: { endedAt },
  });
  await prisma.authAuditLog.create({
    data: {
      actorUserId,
      action: "view_as.end",
      details: { viewAsSessionId: sessionId },
    },
  });
}

/** Applies an active view-as session on top of the real user actor. */
export async function resolveViewAsForActor(
  prisma: PrismaClient,
  realActor: UserActor,
): Promise<Actor> {
  const now = new Date();
  const session = await prisma.viewAsSession.findFirst({
    where: { viewerUserId: realActor.userId, endedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return realActor;
  }

  if (session.expiresAt <= now) {
    await endViewAsSession(prisma, session.id, realActor.userId, now);
    return realActor;
  }

  const targetActor = await loadActorForUser(prisma, session.targetUserId);
  if (targetActor.kind !== "user") {
    return realActor;
  }

  return {
    ...targetActor,
    viewAs: {
      realUserId: realActor.userId,
      expiresAt: session.expiresAt.toISOString(),
    },
  };
}
