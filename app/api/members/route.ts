import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { isMemberServiceError, listMembers } from "@/lib/members/member-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("member.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const prisma = getPrisma();

  try {
    const members = await listMembers(prisma, gate.actor);
    return Response.json({ members });
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
