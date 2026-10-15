import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { isMemberServiceError, setMemberRoles } from "@/lib/members/member-service";
import type { OrganizationRole } from "@/types/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }

  const { userId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const roles = Array.isArray(record.roles) ? (record.roles as OrganizationRole[]) : [];

  const prisma = getPrisma();

  try {
    await setMemberRoles(prisma, gate.actor, userId, roles);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isMemberServiceError(error)) {
      if (error.status === 403) {
        return forbiddenResponse();
      }
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}
