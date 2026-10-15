import { notFound } from "next/navigation";

import { signInWithGoogle } from "@/lib/auth/auth-actions";
import { readAuthEnvConfig } from "@/lib/auth/auth-config";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { findValidInviteByCode } from "@/lib/invites/invite-service";
import { resolveClientIp } from "@/lib/http/client-ip";
import {
  createInviteRateLimitResponse,
  INVITE_RATE_LIMIT_MESSAGE,
} from "@/lib/invites/convite-rate-limit-http";
import { getInviteTokenRateLimiter } from "@/lib/invites/invite-rate-limit";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function ConvitePage({ params }: PageProps) {
  const { code } = await params;
  const configured = readAuthEnvConfig() !== undefined;

  if (!isDatabaseConfigured()) {
    notFound();
  }

  const requestHeaders = await headers();
  const ip = resolveClientIp(new Request("http://local", { headers: requestHeaders }));
  const rateLimited = createInviteRateLimitResponse(ip, Date.now());
  if (rateLimited) {
    return (
      <div className="mx-auto max-w-md ds-card p-8">
        <p className="text-sm text-content">{INVITE_RATE_LIMIT_MESSAGE}</p>
      </div>
    );
  }

  const limiter = getInviteTokenRateLimiter();

  const prisma = getPrisma();
  const invite = await findValidInviteByCode(prisma, code);
  const inviteTeams =
    invite && invite.teamIds.length > 0
      ? await prisma.worshipTeam.findMany({
          where: {
            organizationId: invite.organizationId,
            archivedAt: null,
            id: { in: invite.teamIds },
          },
          select: { name: true },
          orderBy: { name: "asc" },
        })
      : [];
  if (!invite) {
    limiter.recordFailure(ip, Date.now());
    return (
      <div className="mx-auto max-w-md ds-card p-8">
        <p className="text-sm text-content">
          Convite inválido ou expirado. Peça um novo ao administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md ds-card p-8">
      <h1 className="text-2xl font-bold text-content">Convite</h1>
      <p className="mt-2 text-sm text-content-muted">
        Você foi convidado como <strong>{invite.email}</strong>.
      </p>
      <p className="mt-2 text-xs text-content-muted">
        Papéis: {invite.roles.join(", ")}
      </p>
      <p className="mt-1 text-xs text-content-muted">
        Grupos:{" "}
        {inviteTeams.length > 0
          ? inviteTeams.map((team) => team.name).join(", ")
          : "Nenhum"}
      </p>
      <p className="mt-1 text-xs text-content-muted">
        Válido até {new Date(invite.expiresAt).toLocaleString("pt-BR")}
      </p>
      {configured ? (
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signInWithGoogle({ inviteCode: code, next: "/" });
          }}
        >
          <button type="submit" className="ds-button w-full">
            Entrar com Google
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-content-muted">Login indisponível.</p>
      )}
    </div>
  );
}
