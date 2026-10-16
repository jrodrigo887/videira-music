import { cookies } from "next/headers";

import {
  ACCESS_TICKET_COOKIE,
  accessTicketCookieOptions,
  readAccessTicket,
} from "@/lib/access-requests/access-ticket";
import {
  isAccessRequestServiceError,
  listPendingAccessRequests,
  submitAccessRequest,
} from "@/lib/access-requests/access-request-service";
import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID, ensureDefaultOrganization } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUCCESS_MESSAGE = "Pedido enviado. Aguarde o administrador liberar o acesso.";

export async function GET(): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("user.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }
  const prisma = getPrisma();
  try {
    const requests = await listPendingAccessRequests(prisma, gate.actor);
    return Response.json({ requests });
  } catch (error) {
    if (isAccessRequestServiceError(error)) {
      if (error.status === 403) {
        return forbiddenResponse();
      }
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }

  const store = await cookies();
  const token = store.get(ACCESS_TICKET_COOKIE)?.value;
  const ticket = readAccessTicket(token);
  if (!ticket) {
    return Response.json({ error: { code: "ACCESS_TICKET_INVALID" } }, { status: 400 });
  }

  const prisma = getPrisma();
  const organizationId = await ensureDefaultOrganization(prisma);

  try {
    await submitAccessRequest(prisma, organizationId, ticket);
    store.set(ACCESS_TICKET_COOKIE, "", { ...accessTicketCookieOptions(), maxAge: 0 });
    return Response.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    if (isAccessRequestServiceError(error)) {
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}
