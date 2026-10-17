"use client";

import { useCallback, useEffect, useState } from "react";

type Revision = {
  id: string;
  savedAt: string;
};

type ChartHistoryPanelProps = {
  chartId: string;
  canEdit: boolean;
  onRestored?: () => void;
};

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ChartHistoryPanel({ chartId, canEdit, onRestored }: ChartHistoryPanelProps) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canEdit) {
      return;
    }
    setError(null);
    const response = await fetch(`/api/charts/${chartId}/revisions`);
    if (!response.ok) {
      setRevisions([]);
      return;
    }
    const payload = (await response.json()) as { revisions: Revision[] };
    setRevisions(payload.revisions);
  }, [canEdit, chartId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canEdit) {
    return null;
  }

  async function restore(revisionId: string) {
    setRestoringId(revisionId);
    setError(null);
    try {
      const response = await fetch(`/api/charts/${chartId}/revisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!response.ok) {
        setError("Não foi possível restaurar esta versão.");
        return;
      }
      await load();
      if (onRestored) {
        onRestored();
      } else {
        window.location.reload();
      }
    } finally {
      setRestoringId(null);
    }
  }

  const empty = revisions !== null && revisions.length === 0;

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Histórico da cifra">
      <h2 className="text-sm font-semibold text-content">Histórico da cifra</h2>
      {revisions === null ? (
        <p className="mt-2 text-sm text-content-muted">Carregando…</p>
      ) : empty ? (
        <p className="mt-2 text-sm text-content-muted">Nenhuma versão anterior.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="text-content-muted">{formatSavedAt(revision.savedAt)}</span>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-content hover:border-primary hover:text-primary disabled:opacity-50"
                disabled={restoringId === revision.id}
                onClick={() => void restore(revision.id)}
              >
                Restaurar
              </button>
            </li>
          ))}
        </ol>
      )}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
