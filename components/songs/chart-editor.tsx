"use client";

import { useMemo, useState } from "react";

import { ChordChartPreview } from "@/components/chord-chart/chord-chart-preview";
import { applyEditedChart } from "@/lib/charts/apply-edited-chart";
import {
  isEditableChartKey,
  SECTION_TYPE_OPTIONS,
  TONALITY_OPTIONS,
} from "@/lib/charts/chart-edit-options";
import { previewImport } from "@/lib/import/preview-import";
import type { MusicRepository } from "@/lib/persistence/music-repository";
import { RepositoryError } from "@/lib/persistence/repository-error";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, SectionType } from "@/types/music";

const MAX_TEXT_BYTES = 500 * 1024;

export type ChartEditorProps = {
  chart: ChordChart;
  repository: MusicRepository;
  onSaved: () => void;
  onCancel: () => void;
};

function initialSectionTypes(chart: ChordChart): Record<string, SectionType> {
  return Object.fromEntries(chart.sections.map((section) => [section.id, section.type]));
}

function chartForPreview(chart: ChordChart, sections: ChordChart["sections"]): ChordChart {
  return { ...chart, sections };
}

export function ChartEditor({ chart, repository, onSaved, onCancel }: ChartEditorProps) {
  const savedSource = chart.source ?? "";
  const [text, setText] = useState(savedSource);
  const [key, setKey] = useState(chart.key);
  const [capoInput, setCapoInput] = useState(chart.capo ? String(chart.capo) : "");
  const [sectionTypes, setSectionTypes] = useState<Record<string, SectionType>>(() =>
    initialSectionTypes(chart),
  );
  const [parsed, setParsed] = useState<ImportDraft | undefined>();
  const [validationError, setValidationError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const textChanged = text !== savedSource;
  const warnings = parsed?.warnings ?? [];

  const previewSections = useMemo(() => {
    if (parsed) {
      return parsed.chart.sections.map((section) => ({
        ...section,
        type: sectionTypes[section.id] ?? section.type,
      }));
    }
    return chart.sections.map((section) => ({
      ...section,
      type: sectionTypes[section.id] ?? section.type,
    }));
  }, [chart.sections, parsed, sectionTypes]);

  const previewChart = useMemo(
    () => chartForPreview(chart, previewSections),
    [chart, previewSections],
  );

  const tonalityOptions = TONALITY_OPTIONS.includes(key)
    ? TONALITY_OPTIONS
    : [key, ...TONALITY_OPTIONS].filter(Boolean);

  const keyValid = isEditableChartKey(key);
  const canSave = keyValid && !busy;

  function handleTextChange(next: string) {
    setText(next);
    setValidationError(undefined);
    setSaveError(undefined);

    if (next === savedSource) {
      setParsed(undefined);
      setSectionTypes(initialSectionTypes(chart));
      return;
    }

    const draft = previewImport({ text: next, origin: chart.origin });
    setParsed(draft);
    setSectionTypes(
      Object.fromEntries(draft.chart.sections.map((section) => [section.id, section.type])),
    );
  }

  function handleCapoChange(value: string) {
    setCapoInput(value);
    setSaveError(undefined);
  }

  function parseCapo(): number | undefined {
    const trimmed = capoInput.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsedCapo = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsedCapo) && parsedCapo > 0 ? parsedCapo : undefined;
  }

  async function save() {
    setValidationError(undefined);
    setSaveError(undefined);

    if (!text.trim()) {
      setValidationError("Informe o texto da cifra.");
      return;
    }

    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength > MAX_TEXT_BYTES) {
      setValidationError("O texto deve ter no máximo 500 KiB.");
      return;
    }

    if (!keyValid) {
      return;
    }

    setBusy(true);
    try {
      const nextChart = applyEditedChart({
        existing: chart,
        key,
        capo: parseCapo(),
        sectionTypes,
        parsed: textChanged ? parsed : undefined,
      });
      await repository.saveChart(nextChart);
      onSaved();
    } catch (cause) {
      void cause;
      if (cause instanceof RepositoryError) {
        setSaveError("Nada foi salvo. Revise os dados e tente novamente.");
        return;
      }
      setSaveError("Nada foi salvo. Revise os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Editor de cifra">
      {validationError ? (
        <p role="alert" className="ds-card-muted">{validationError}</p>
      ) : null}
      {saveError ? <p role="alert" className="ds-card-muted">{saveError}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="ds-card block space-y-2">
          <span className="text-sm font-medium text-content-muted">Texto da cifra</span>
          <textarea
            aria-label="Texto da cifra"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            className="ds-input min-h-48 font-mono"
          />
        </label>
        <ChordChartPreview chart={previewChart} layout="embedded" />
      </div>

      {warnings.length ? (
        <section className="ds-card-muted">
          <h2 className="font-semibold text-content">Avisos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.line ?? index}`}>
                {warning.line ? `Linha ${warning.line}: ` : ""}
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ds-card space-y-4">
        <h2 className="text-lg font-semibold text-content">Seções, tom e capo</h2>
        {previewSections.map((section) => (
          <label key={section.id} className="block">
            <span className="text-sm font-medium text-content-muted">{section.label}</span>
            <select
              aria-label={`Tipo de ${section.label}`}
              value={sectionTypes[section.id] ?? section.type}
              onChange={(event) => {
                const type = event.target.value as SectionType;
                setSectionTypes((current) => ({ ...current, [section.id]: type }));
                setSaveError(undefined);
              }}
              className="ds-input mt-2"
            >
              {SECTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-content-muted">Tom da cifra</span>
            <select
              aria-label="Tom da cifra"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setSaveError(undefined);
              }}
              className="ds-input mt-2"
            >
              {tonalityOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-content-muted">Capo</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={capoInput}
              onChange={(event) => handleCapoChange(event.target.value)}
              placeholder="Sem capo"
              className="ds-input mt-2"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="ds-button" disabled={!canSave} onClick={() => void save()}>
          {busy ? "Salvando…" : "Salvar cifra"}
        </button>
        <button type="button" className="ds-button-secondary" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
