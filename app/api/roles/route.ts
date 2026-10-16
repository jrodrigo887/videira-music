import { forbiddenResponse, requirePermission } from "@/lib/auth/api-guard";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { createRole, isRoleServiceError, listRoles } from "@/lib/roles/role-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("role.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const prisma = getPrisma();
  try {
    const roles = await listRoles(prisma, gate.actor);
    return Response.json({ roles });
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

export async function POST(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requirePermission("role.manage", DEFAULT_ORGANIZATION_ID);
  if ("response" in gate) {
    return gate.response;
  }

  const body = (await request.json()) as { label?: string; capabilities?: string[] };
  const prisma = getPrisma();

  try {
    const role = await createRole(prisma, gate.actor, {
      label: String(body.label ?? ""),
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.map(String) : [],
    });
    return Response.json({ role }, { status: 201 });
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
