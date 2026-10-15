import "server-only";

import type { ValidateUserInfoResult } from "better-auth";
import { getOAuthState } from "better-auth/api";

import { getDefaultOrganizationId } from "@/lib/persistence/organization-scope";
import { ensureSqlitePragmas, getPrisma } from "@/lib/persistence/prisma-client";

import { readAuthEnvConfig } from "./auth-config";
import { normalizeEmail } from "./email";
import {
  acceptInvite,
  bootstrapAdminUser,
  findActiveMemberByEmail,
  findValidInviteByCode,
  linkAuthUserToMember,
} from "@/lib/invites/invite-service";

function emailVerifiedFromProfile(profile: Record<string, unknown> | undefined): boolean {
  return profile?.email_verified === true;
}

async function readInviteCodeFromOAuthState(): Promise<string | undefined> {
  const state = await getOAuthState<{ inviteCode?: string }>();
  return typeof state?.inviteCode === "string" ? state.inviteCode : undefined;
}

export async function validateUserInfo(data: {
  user: { email?: string | null; name?: string | null; image?: string | null };
  source: {
    action: "create-user" | "link-account" | "sign-in";
    method: string;
    oauth?: { providerId: string; profile?: Record<string, unknown> };
  };
}): Promise<ValidateUserInfoResult | void> {
  const profile = data.source.oauth?.profile;
  if (data.source.method === "oauth" && !emailVerifiedFromProfile(profile)) {
    return { error: "email_not_verified" };
  }

  const email = normalizeEmail(String(data.user.email ?? profile?.email ?? ""));
  if (!email) {
    return { error: "no_access" };
  }

  const prisma = getPrisma();
  await ensureSqlitePragmas(prisma);
  const organizationId = await getDefaultOrganizationId(prisma);

  const member = await findActiveMemberByEmail(prisma, organizationId, email);
  if (member?.status === "deactivated") {
    return { error: "no_access" };
  }

  if (data.source.action === "sign-in") {
    if (!member || member.status !== "active") {
      return { error: "no_access" };
    }
    return;
  }

  if (data.source.action === "create-user") {
    if (member) {
      return { error: "no_access" };
    }

    const config = readAuthEnvConfig();
    const bootstrapEmail = config?.bootstrapAdminEmail;
    const adminCount = await prisma.userRole.count({
      where: {
        role: "admin",
        user: { organizationId, status: "active" },
      },
    });

    if (adminCount === 0 && bootstrapEmail && email === bootstrapEmail) {
      return;
    }

    const inviteCode = await readInviteCodeFromOAuthState();
    if (!inviteCode) {
      return { error: "no_access" };
    }

    const invite = await findValidInviteByCode(prisma, inviteCode);
    if (!invite || normalizeEmail(invite.email) !== email) {
      return { error: "invite_email_mismatch" };
    }
  }
}

export async function completeOAuthSignIn(authUser: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}): Promise<"ok" | "invalid"> {
  const prisma = getPrisma();
  await ensureSqlitePragmas(prisma);
  const organizationId = await getDefaultOrganizationId(prisma);
  const email = normalizeEmail(authUser.email);

  const existing = await prisma.user.findFirst({
    where: { organizationId, email },
    select: { id: true, status: true, authUserId: true },
  });

  if (existing?.status === "active") {
    if (!existing.authUserId) {
      await linkAuthUserToMember(prisma, existing.id, authUser.id);
    }
    return "ok";
  }

  const config = readAuthEnvConfig();
  const adminCount = await prisma.userRole.count({
    where: {
      role: "admin",
      user: { organizationId, status: "active" },
    },
  });

  if (
    adminCount === 0 &&
    config?.bootstrapAdminEmail &&
    email === config.bootstrapAdminEmail
  ) {
    const created = await bootstrapAdminUser(prisma, {
      organizationId,
      authUserId: authUser.id,
      email,
      name: authUser.name,
    });
    return created ? "ok" : "invalid";
  }

  const inviteCode = await readInviteCodeFromOAuthState();
  if (inviteCode) {
    const result = await acceptInvite(prisma, {
      code: inviteCode,
      authUserId: authUser.id,
      email,
      name: authUser.name,
      image: authUser.image,
    });
    if (result === "accepted") {
      return "ok";
    }
    return "invalid";
  }

  return "invalid";
}

export async function invalidateAuthSessions(authUserId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.authSession.deleteMany({ where: { userId: authUserId } });
}
