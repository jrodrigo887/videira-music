import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { deleteRole, isRoleServiceError, updateRole } from "@/lib/roles/role-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  if (gate.actor.kind !== "user") {
    return forbiddenResponse();
  }

  const { key } = await context.params;
  const body = (await request.json()) as { label?: string; capabilities?: string[] };
  const prisma = getPrisma();

  try {
    const role = await updateRole(prisma, gate.actor, decodeURIComponent(key), {
      label: body.label !== undefined ? String(body.label) : undefined,
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.map(String) : undefined,
    });
    return Response.json({ role });
  } catch (error) {
    if (isRoleServiceError(error)) {
      if (error.status === 403) {
        return forbiddenResponse();
      }
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  if (gate.actor.kind !== "user") {
    return forbiddenResponse();
  }

  const { key } = await context.params;
  const prisma = getPrisma();

  try {
    await deleteRole(prisma, gate.actor, decodeURIComponent(key));
    return Response.json({ ok: true });
  } catch (error) {
    if (isRoleServiceError(error)) {
      if (error.status === 403) {
        return forbiddenResponse();
      }
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}
