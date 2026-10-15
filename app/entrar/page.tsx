import Link from "next/link";
import { cookies } from "next/headers";

import { RequestAccessButton } from "@/components/auth/request-access-button";
import { ACCESS_TICKET_COOKIE, readAccessTicket } from "@/lib/access-requests/access-ticket";
import { signInWithGoogle } from "@/lib/auth/auth-actions";
import { readAuthEnvConfig } from "@/lib/auth/auth-config";
import { safeNextPath } from "@/lib/auth/page-gate";

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string; requested?: string }>;
};

function errorMessage(code: string | undefined): string | undefined {
  if (code === "unavailable") {
    return "Login indisponível.";
  }
  if (code === "google" || code === "no_access" || code === "email_not_verified") {
    return "Esta conta não tem acesso. Peça um convite ao administrador da igreja.";
  }
  if (code === "invite_email_mismatch") {
    return "Este convite é para outro e-mail. Entre com a conta Google convidada.";
  }
  if (code === "google_cancel") {
    return "Não foi possível entrar com o Google. Tente de novo.";
  }
  return undefined;
}

export default async function EntrarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = readAuthEnvConfig() !== undefined;
  const message = params.requested === "1"
    ? "Pedido enviado. Aguarde o administrador liberar o acesso."
    : errorMessage(params.error);

  const store = await cookies();
  const accessTicket = readAccessTicket(store.get(ACCESS_TICKET_COOKIE)?.value);
  const showAccessRequest = Boolean(accessTicket) && params.requested !== "1";

  return (
    <div className="mx-auto max-w-md ds-card p-8">
      <h1 className="text-2xl font-bold text-content">Entrar</h1>
      <p className="mt-2 text-sm text-content-muted">
        Use sua conta Google da igreja. O acesso é por convite ou liberação do administrador.
      </p>
      {message ? (
        <p className="mt-4 rounded-lg bg-surface-muted px-4 py-3 text-sm text-content" role="alert">
          {message}
        </p>
      ) : null}
      {configured ? (
        <>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signInWithGoogle({ next });
            }}
          >
            <button type="submit" className="ds-button w-full">
              Entrar com Google
            </button>
          </form>
          {showAccessRequest ? <RequestAccessButton /> : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-content-muted">Login indisponível.</p>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-primary hover:underline">
          Ver letras públicas
        </Link>
      </p>
    </div>
  );
}
