import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { can } from "@/lib/auth/permissions";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import {
  createInvite,
  isInviteServiceError,
  listPendingInvites,
} from "@/lib/invites/invite-service";
import type { OrganizationRole } from "@/types/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  if (!can(gate.actor, "users:invite", { organizationId: gate.actor.organizationId })) {
    return forbiddenResponse();
  }
  const prisma = getPrisma();
  const invites = await listPendingInvites(prisma, gate.actor);
  return Response.json({ invites });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "DATABASE_NOT_CONFIGURED" } }, { status: 503 });
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  if (!can(gate.actor, "users:invite", { organizationId: gate.actor.organizationId })) {
    return forbiddenResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const email = String(record.email ?? "");
  const roles = Array.isArray(record.roles) ? (record.roles as OrganizationRole[]) : [];
  const teamIds = Array.isArray(record.teamIds) ? record.teamIds.map(String) : [];
  const expiresInHours = Number(record.expiresInHours ?? 24 * 7);

  const prisma = getPrisma();

  try {
    const result = await createInvite(prisma, gate.actor, {
      email,
      roles,
      teamIds,
      expiresInHours,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (isInviteServiceError(error)) {
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    throw error;
  }
}
