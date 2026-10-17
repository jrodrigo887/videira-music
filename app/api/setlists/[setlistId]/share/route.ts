import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { viewAsMutationResponse } from "@/lib/auth/view-as-guard";
import { persistenceError } from "@/lib/persistence/persistence-api";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import {
  createShareLink,
  isShareLinkServiceError,
  revokeShareLink,
} from "@/lib/setlists/share-link-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapShareError(
  error: import("@/lib/setlists/share-link-service").ShareLinkServiceError,
): Response {
  if (error.code === "FORBIDDEN") {
    return forbiddenResponse();
  }
  return persistenceError(error.status, error.code, error.userMessage);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ setlistId: string }> },
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

  const { setlistId } = await context.params;
  const prisma = getPrisma();
  try {
    const { code } = await createShareLink(prisma, gate.actor, setlistId);
    return Response.json({ code }, { status: 201 });
  } catch (error) {
    if (isShareLinkServiceError(error)) {
      return mapShareError(error);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ setlistId: string }> },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
  }
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const linkId = typeof record.linkId === "string" ? record.linkId : "";
  if (!linkId) {
    return persistenceError(400, "INVALID_REQUEST", "Informe linkId.");
  }

  const { setlistId } = await context.params;
  const prisma = getPrisma();
  try {
    await revokeShareLink(prisma, gate.actor, setlistId, linkId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isShareLinkServiceError(error)) {
      return mapShareError(error);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}
