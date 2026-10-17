"use client";

import { useCallback, useEffect, useState } from "react";

type Revision = {
  id: string;
  savedAt: string;
  versionLabel?: string | null;
};

export type ChartVersionOption = {
  chartId: string;
  label: string;
};

type ChartHistoryPanelProps = {
  chartId: string;
  songTitle: string;
  versionLabel?: string;
  versions?: ChartVersionOption[];
  canEdit: boolean;
  onRestored?: () => void;
  onSelectVersion?: (chartId: string) => void;
};

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function historyHeading(songTitle: string, versionLabel: string): string {
  return versionLabel ? `${songTitle} - ${versionLabel}` : songTitle;
}

export function ChartHistoryPanel({
  chartId,
  songTitle,
  versionLabel,
  versions = [],
  canEdit,
  onRestored,
  onSelectVersion,
}: ChartHistoryPanelProps) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canEdit) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/charts/${chartId}/revisions`);
      if (!response.ok) {
        setRevisions([]);
        return;
      }
      const payload = (await response.json()) as { revisions: Revision[] };
      setRevisions(payload.revisions);
    } catch {
      setRevisions([]);
    }
  }, [canEdit, chartId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canEdit && versions.length === 0) {
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
  const currentVersion = (versionLabel ?? "").trim();

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-label="Histórico da cifra"
    >
      <h2 className="text-xs font-semibold text-content">Histórico da cifra</h2>

      {versions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-content">Versão</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Versões">
            {versions.map((version) => {
              const selected = version.chartId === chartId;
              return (
                <button
                  key={version.chartId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectVersion?.(version.chartId)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "bg-content text-content-inverse"
                      : "bg-surface-muted text-content-muted hover:text-content"
                  }`}
                >
                  {version.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!canEdit ? null : revisions === null ? (
        <p className="mt-3 text-[12px] text-content-muted">Carregando…</p>
      ) : empty ? (
        <p className="mt-3 text-[12px] text-content-muted">Nenhuma versão anterior.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {revisions.map((revision) => {
            const version = revision.versionLabel?.trim() || currentVersion;
            return (
              <li
                key={revision.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-2"
              >
                <p className="min-w-0 text-[12px] leading-snug text-content">
                  <span className="block font-medium">{historyHeading(songTitle, version)}</span>
                  <time dateTime={revision.savedAt} className="text-[12px] text-content-muted">
                    {formatSavedAt(revision.savedAt)}
                  </time>
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[12px] font-medium text-content hover:border-primary hover:text-primary disabled:opacity-50"
                  disabled={restoringId === revision.id}
                  onClick={() => void restore(revision.id)}
                >
                  Restaurar
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </section>
  );
}
