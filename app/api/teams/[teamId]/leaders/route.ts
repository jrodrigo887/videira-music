import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { isMemberServiceError, setTeamLeaders } from "@/lib/members/member-service";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }

  const { teamId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const userIds = Array.isArray(record.userIds) ? record.userIds.map(String) : [];

  const prisma = getPrisma();

  try {
    await setTeamLeaders(prisma, gate.actor, teamId, userIds);
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
