"use client";

import { useState } from "react";

type ImportUnlockPanelProps = {
  onUnlocked?: () => void;
};

function minutesFromRetryAfter(retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : 60;
  return Math.ceil((Number.isFinite(seconds) ? seconds : 60) / 60);
}

export function ImportUnlockPanel({ onUnlocked }: ImportUnlockPanelProps) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/imports/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (response.status === 204) {
        setSecret("");
        onUnlocked?.();
        return;
      }

      const body = (await response.json()) as { error?: { code?: string } };
      const code = body.error?.code;

      if (response.status === 401 && code === "INVALID_SECRET") {
        setSecret("");
        setError("Segredo inválido.");
        return;
      }

      if (response.status === 429 && code === "TOO_MANY_ATTEMPTS") {
        const minutes = minutesFromRetryAfter(response.headers.get("Retry-After"));
        setSecret("");
        setError(`Muitas tentativas. Tente novamente em ${minutes} minutos.`);
        return;
      }

      setError("Não foi possível desbloquear o import.");
    } catch {
      setError("Não foi possível desbloquear o import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ds-card mx-auto max-w-md space-y-4">
      <div>
        <p className="ds-eyebrow">Acesso restrito</p>
        <h2 className="mt-2 text-xl font-semibold text-content">Desbloquear import</h2>
        <p className="mt-2 text-sm text-content-muted">
          Digite o segredo de admin para usar o módulo de importação neste dispositivo.
        </p>
      </div>
      {error ? <p role="alert" className="ds-card-muted">{error}</p> : null}
      <label className="block">
        <span className="text-sm font-medium text-content-muted">Segredo</span>
        <input
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="ds-input mt-2"
        />
      </label>
      <button type="button" className="ds-button w-full" disabled={busy || !secret.trim()} onClick={unlock}>
        Desbloquear
      </button>
    </section>
  );
}
