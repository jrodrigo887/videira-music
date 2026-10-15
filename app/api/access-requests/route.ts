import { cookies } from "next/headers";

import {
  ACCESS_TICKET_COOKIE,
  accessTicketCookieOptions,
  readAccessTicket,
} from "@/lib/access-requests/access-ticket";
import {
  isAccessRequestServiceError,
  submitAccessRequest,
} from "@/lib/access-requests/access-request-service";
import { ensureDefaultOrganization } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUCCESS_MESSAGE = "Pedido enviado. Aguarde o administrador liberar o acesso.";

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
