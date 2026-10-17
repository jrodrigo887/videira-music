import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { viewAsMutationResponse } from "@/lib/auth/view-as-guard";
import {
  approveSuggestion,
  isChartSuggestionServiceError,
  listPendingSuggestions,
  rejectSuggestion,
  submitSuggestion,
} from "@/lib/charts/chart-suggestion-service";
import { persistenceError } from "@/lib/persistence/persistence-api";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapSuggestionError(
  error: import("@/lib/charts/chart-suggestion-service").ChartSuggestionServiceError,
): Response {
  if (error.code === "FORBIDDEN") {
    return forbiddenResponse();
  }
  return persistenceError(error.status, error.code, error.userMessage);
}

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
    const suggestions = await listPendingSuggestions(prisma, gate.actor, chartId);
    return Response.json({ suggestions });
  } catch (error) {
    if (isChartSuggestionServiceError(error)) {
      return mapSuggestionError(error);
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
  const viewAsBlock = viewAsMutationResponse(gate.actor);
  if (viewAsBlock) {
    return viewAsBlock;
  }

  const { chartId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
  }

  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const action = typeof record.action === "string" ? record.action : "submit";
  const suggestionId = typeof record.suggestionId === "string" ? record.suggestionId : "";

  const prisma = getPrisma();
  try {
    if (action === "approve") {
      if (!suggestionId) {
        return persistenceError(400, "INVALID_REQUEST", "Informe suggestionId.");
      }
      await approveSuggestion(prisma, gate.actor, suggestionId);
      return new Response(null, { status: 200 });
    }
    if (action === "reject") {
      if (!suggestionId) {
        return persistenceError(400, "INVALID_REQUEST", "Informe suggestionId.");
      }
      await rejectSuggestion(prisma, gate.actor, suggestionId);
      return new Response(null, { status: 200 });
    }

    const source = typeof record.source === "string" ? record.source : "";
    const key = typeof record.key === "string" ? record.key : undefined;
    const capo =
      typeof record.capo === "number"
        ? record.capo
        : record.capo === null
          ? null
          : undefined;

    const result = await submitSuggestion(prisma, gate.actor, chartId, { source, key, capo });
    return new Response(null, { status: result.status === "created" ? 201 : 200 });
  } catch (error) {
    if (isChartSuggestionServiceError(error)) {
      return mapSuggestionError(error);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}
