import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import {
  isChartHistoryServiceError,
  listRevisions,
  restoreRevision,
} from "@/lib/charts/chart-history-service";
import { persistenceError } from "@/lib/persistence/persistence-api";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ chartId: string }> },
): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco não configurado.");
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  const { chartId } = await context.params;
  const prisma = getPrisma();
  try {
    const revisions = await listRevisions(prisma, gate.actor, chartId);
    return Response.json({ revisions });
  } catch (error) {
    if (isChartHistoryServiceError(error)) {
      if (error.code === "FORBIDDEN") {
        return forbiddenResponse();
      }
      return persistenceError(error.status, error.code, error.code);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chartId: string }> },
): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco não configurado.");
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  const { chartId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
  }
  const revisionId =
    typeof body === "object" && body !== null && "revisionId" in body
      ? String((body as { revisionId: unknown }).revisionId)
      : "";
  if (!revisionId) {
    return persistenceError(400, "INVALID_REQUEST", "Informe revisionId.");
  }

  const prisma = getPrisma();
  try {
    const chart = await restoreRevision(prisma, gate.actor, chartId, revisionId);
    return Response.json({ chart });
  } catch (error) {
    if (isChartHistoryServiceError(error)) {
      if (error.code === "FORBIDDEN") {
        return forbiddenResponse();
      }
      return persistenceError(error.status, error.code, error.code);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}
