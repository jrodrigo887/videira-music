import { requireActor } from "@/lib/auth/api-guard";
import { persistenceError } from "@/lib/persistence/persistence-api";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { isSongTrashServiceError, restoreSong } from "@/lib/songs/song-trash-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ songId: string }> },
): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco não configurado.");
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  const { songId } = await context.params;
  const prisma = getPrisma();
  try {
    await restoreSong(prisma, gate.actor, songId);
    return Response.json({ ok: true });
  } catch (error) {
    if (isSongTrashServiceError(error)) {
      return persistenceError(error.status, error.code, error.code);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}
