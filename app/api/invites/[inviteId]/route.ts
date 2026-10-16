import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { isInviteServiceError, revokeInvite } from "@/lib/invites/invite-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ inviteId: string }> };

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("users:invite", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const { inviteId } = await context.params;
  const prisma = getPrisma();

  try {
    await revokeInvite(prisma, gate.actor, inviteId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isInviteServiceError(error)) {
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}
