import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  approveAccessRequest,
  isAccessRequestServiceError,
} from "@/lib/access-requests/access-request-service";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("user.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { roles?: string[]; teamIds?: string[] };
  const prisma = getPrisma();

  try {
    await approveAccessRequest(prisma, gate.actor, id, {
      roles: Array.isArray(body.roles) ? body.roles.map(String) : [],
      teamIds: Array.isArray(body.teamIds) ? body.teamIds.map(String) : [],
    });
    return Response.json({ ok: true });
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
