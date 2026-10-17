"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CHART_SOURCE_TOO_LARGE_MESSAGE,
  EMPTY_CHART_SOURCE_MESSAGE,
  validateChartSourceText,
} from "@/lib/charts/chart-source-limits";

type PendingSuggestion = {
  id: string;
  authorUserId: string;
  authorName: string | null;
  source: string;
  key: string;
  createdAt: string;
};

type ChartSuggestionPanelProps = {
  chartId: string;
  canReview: boolean;
  canSuggest: boolean;
  onChanged?: () => void;
};

export function ChartSuggestionPanel({
  chartId,
  canReview,
  canSuggest,
  onChanged,
}: ChartSuggestionPanelProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<PendingSuggestion[] | null>(null);

  const loadQueue = useCallback(async () => {
    if (!canReview) {
      return;
    }
    try {
      const response = await fetch(`/api/charts/${chartId}/suggestions`);
      if (!response.ok) {
        setQueue([]);
        return;
      }
      const payload = (await response.json()) as { suggestions: PendingSuggestion[] };
      setQueue(payload.suggestions);
    } catch {
      setQueue([]);
    }
  }, [canReview, chartId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  if (!canReview && !canSuggest) {
    return null;
  }

  async function submitSuggestion() {
    setValidationError(null);
    setSubmitError(null);
    const validated = validateChartSourceText(text);
    if (!validated.ok) {
      setValidationError(validated.message);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/charts/${chartId}/suggestions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: text }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSubmitError(body?.error?.message ?? "Não foi possível enviar a sugestão.");
        return;
      }
      setText("");
      setOpen(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function review(suggestionId: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      const response = await fetch(`/api/charts/${chartId}/suggestions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, suggestionId }),
      });
      if (!response.ok) {
        return;
      }
      await loadQueue();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      aria-label="Sugestões de cifra"
    >
      {canSuggest ? (
        <div className="space-y-2">
          {!open ? (
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => setOpen(true)}
            >
              Sugerir correção
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-content" htmlFor={`suggest-${chartId}`}>
                Texto da cifra sugerida
              </label>
              <textarea
                id={`suggest-${chartId}`}
                className="min-h-32 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-content"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setValidationError(null);
                }}
              />
              {validationError ? (
                <p role="alert" className="text-sm text-danger">
                  {validationError === EMPTY_CHART_SOURCE_MESSAGE ||
                  validationError === CHART_SOURCE_TOO_LARGE_MESSAGE
                    ? validationError
                    : validationError}
                </p>
              ) : null}
              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-content-inverse disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void submitSuggestion()}
                >
                  Enviar sugestão
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-content"
                  onClick={() => {
                    setOpen(false);
                    setValidationError(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {canReview ? (
        <div className={canSuggest ? "mt-4 border-t border-border pt-4" : ""}>
          <h2 className="text-xs font-semibold text-content">Sugestões pendentes</h2>
          {queue === null ? (
            <p className="mt-2 text-[12px] text-content-muted">Carregando…</p>
          ) : queue.length === 0 ? (
            <p className="mt-2 text-[12px] text-content-muted">Nenhuma sugestão pendente.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {queue.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium text-content">
                    {item.authorName ?? item.authorUserId}
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-content-muted">
                    {item.source}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-content-inverse disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void review(item.id, "approve")}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-content disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void review(item.id, "reject")}
                    >
                      Rejeitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
