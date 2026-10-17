"use client";

import { useState } from "react";

import { CHART_VERSION_MAX_LENGTH } from "@/lib/charts/chart-versions";

type ChartVersionFieldProps = {
  value: string;
  options: string[];
  onChange: (label: string) => void;
  onCreate: (label: string) => void;
};

const selectedClass = "bg-content text-content-inverse";
const idleClass = "bg-surface-muted text-content-muted hover:text-content";

export function ChartVersionField({ value, options, onChange, onCreate }: ChartVersionFieldProps) {
  const [draft, setDraft] = useState("");
  const selectedKey = value.trim().toLowerCase();

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    onCreate(trimmed);
    setDraft("");
  }

  return (
    <div>
      <p className="text-sm font-medium text-content-muted">Versão</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Versão da cifra">
        {options.map((option) => {
          const selected = option.toLowerCase() === selectedKey;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selected ? selectedClass : idleClass
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Adicionar versão"
          value={draft}
          maxLength={CHART_VERSION_MAX_LENGTH}
          placeholder="Adicionar versão"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          className="ds-input"
        />
        <button
          type="button"
          className="ds-button-secondary shrink-0"
          disabled={!draft.trim()}
          onClick={commit}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
