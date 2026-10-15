import { notFound } from "next/navigation";

import { signInWithGoogle } from "@/lib/auth/auth-actions";
import { readAuthEnvConfig } from "@/lib/auth/auth-config";
import { ensureSqlitePragmas, getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { findValidInviteByCode } from "@/lib/invites/invite-service";
import { resolveClientIp } from "@/lib/http/client-ip";
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
  const limiter = getInviteTokenRateLimiter();
  const decision = limiter.check(ip, Date.now());
  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-md ds-card p-8">
        <p className="text-sm text-content">Muitas tentativas. Tente novamente em alguns minutos.</p>
      </div>
    );
  }

  const prisma = getPrisma();
  await ensureSqlitePragmas(prisma);
  const invite = await findValidInviteByCode(prisma, code);
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
        Papéis: {invite.roles.join(", ")} · válido até{" "}
        {new Date(invite.expiresAt).toLocaleString("pt-BR")}
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
