import "server-only";

import type { ValidateUserInfoResult } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { cookies } from "next/headers";

import { ensureDefaultOrganization } from "@/lib/persistence/organization-scope";
import { getPrisma } from "@/lib/persistence/prisma-client";

import {
  ACCESS_TICKET_COOKIE,
  accessTicketCookieOptions,
  signAccessTicket,
} from "@/lib/access-requests/access-ticket";
import {
  acceptInvite,
  bootstrapAdminUser,
  findActiveMemberByEmail,
  findValidInviteByCode,
  linkAuthUserToMember,
} from "@/lib/invites/invite-service";

import { readAuthEnvConfig } from "./auth-config";
import { normalizeEmail } from "./email";

export type AccessTicketHooks = {
  setAccessTicket?: (token: string) => void | Promise<void>;
  clearAccessTicket?: () => void | Promise<void>;
};

let testAccessTicketHooks: AccessTicketHooks | undefined;

export function setAccessTicketHooksForTests(hooks: AccessTicketHooks | undefined): void {
  testAccessTicketHooks = hooks;
}

async function defaultSetAccessTicket(token: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TICKET_COOKIE, token, accessTicketCookieOptions());
}

async function defaultClearAccessTicket(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TICKET_COOKIE);
}

async function issueAccessTicket(
  email: string,
  name: string,
  hooks?: AccessTicketHooks,
): Promise<void> {
  const token = signAccessTicket({ email, name });
  const setTicket = hooks?.setAccessTicket ?? testAccessTicketHooks?.setAccessTicket ?? defaultSetAccessTicket;
  await setTicket(token);
}

async function clearAccessTicket(hooks?: AccessTicketHooks): Promise<void> {
  const clear =
    hooks?.clearAccessTicket ?? testAccessTicketHooks?.clearAccessTicket ?? defaultClearAccessTicket;
  await clear();
}

function emailVerifiedFromProfile(profile: Record<string, unknown> | undefined): boolean {
  return profile?.email_verified === true;
}

async function readInviteCodeFromOAuthState(): Promise<string | undefined> {
  const state = await getOAuthState<{ inviteCode?: string }>();
  return typeof state?.inviteCode === "string" ? state.inviteCode : undefined;
}

export async function validateUserInfo(
  data: {
    user: { email?: string | null; name?: string | null; image?: string | null };
    source: {
      action: "create-user" | "link-account" | "sign-in";
      method: string;
      oauth?: { providerId: string; profile?: Record<string, unknown> };
    };
  },
  hooks?: AccessTicketHooks,
): Promise<ValidateUserInfoResult | void> {
  const profile = data.source.oauth?.profile;
  if (data.source.method === "oauth" && !emailVerifiedFromProfile(profile)) {
    return { error: "email_not_verified" };
  }

  const email = normalizeEmail(String(data.user.email ?? profile?.email ?? ""));
  if (!email) {
    return { error: "no_access" };
  }

  const prisma = getPrisma();
  const organizationId = await ensureDefaultOrganization(prisma);

  const member = await findActiveMemberByEmail(prisma, organizationId, email);
  if (member?.status === "deactivated") {
    return { error: "no_access" };
  }

  if (data.source.action === "sign-in") {
    if (!member || member.status !== "active") {
      await issueAccessTicket(email, String(data.user.name ?? profile?.name ?? email), hooks);
      return { error: "no_access" };
    }
    await clearAccessTicket(hooks);
    return;
  }

  if (data.source.action === "create-user") {
    if (member?.status === "active") {
      if (!member.authUserId) {
        await clearAccessTicket(hooks);
        return;
      }
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
      await clearAccessTicket(hooks);
      return;
    }

    const inviteCode = await readInviteCodeFromOAuthState();
    if (!inviteCode) {
      await issueAccessTicket(email, String(data.user.name ?? profile?.name ?? email), hooks);
      return { error: "no_access" };
    }

    const invite = await findValidInviteByCode(prisma, inviteCode);
    if (!invite || normalizeEmail(invite.email) !== email) {
      return { error: "invite_email_mismatch" };
    }

    await clearAccessTicket(hooks);
  }
}

export async function completeOAuthSignIn(authUser: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}): Promise<"ok" | "invalid"> {
  const prisma = getPrisma();
  const organizationId = await ensureDefaultOrganization(prisma);
  const email = normalizeEmail(authUser.email);

  const existing = await prisma.user.findFirst({
    where: { organizationId, email },
    select: { id: true, status: true, authUserId: true },
  });

  if (existing?.status === "active") {
    if (!existing.authUserId) {
      await linkAuthUserToMember(prisma, existing.id, authUser.id);
    }
    await clearAccessTicket();
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
      await clearAccessTicket();
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
