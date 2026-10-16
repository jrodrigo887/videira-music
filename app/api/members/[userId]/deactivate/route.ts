import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { deactivateMember, isMemberServiceError } from "@/lib/members/member-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("user.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const { userId } = await context.params;
  const prisma = getPrisma();

  try {
    await deactivateMember(prisma, gate.actor, userId);
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
