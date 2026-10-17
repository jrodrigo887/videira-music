"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type TeamInviteFormProps = {
  teamId: string;
  teamName: string;
};

type ApiError = { error?: { code?: string; message?: string } };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function TeamInviteForm({ teamId, teamName }: TeamInviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setCreatedLink(null);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          roles: ["musician"],
          teamIds: [teamId],
          expiresInHours: 24 * 7,
        }),
      });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Não foi possível criar o convite."));
        return;
      }
      const body = (await response.json()) as { link: string };
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setCreatedLink(`${origin}${body.link}`);
      setEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ds-card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-content">Convidar músico</h2>
        <p className="text-sm text-content-muted">
          O convite vale só para o grupo <strong>{teamName}</strong>, como músico.
        </p>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm font-medium text-content">
          E-mail
          <input
            type="email"
            required
            className="ds-input mt-1 w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          Enviar convite
        </Button>
      </form>
      {message ? <Alert>{message}</Alert> : null}
      {createdLink ? (
        <p className="text-sm text-content-muted">
          Link do convite:{" "}
          <a className="text-accent underline" href={createdLink}>{createdLink}</a>
        </p>
      ) : null}
    </section>
  );
}
