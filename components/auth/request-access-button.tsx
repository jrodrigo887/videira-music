"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestAccessButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/access-requests", { method: "POST" });
      if (!response.ok) {
        setError("Não foi possível enviar o pedido. Tente entrar com o Google de novo.");
        return;
      }
      router.replace("/entrar?requested=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button type="button" className="ds-button w-full" disabled={busy} onClick={() => void submit()}>
        Solicitar acesso
      </button>
      {error ? (
        <p className="text-sm text-content-muted" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
