"use client";

import { useState } from "react";

import { transposeChord } from "@/lib/chords/transpose-chord";
import type {
  ChordChart,
  GridSectionContent,
  LyricsSectionContent,
  Section,
  SectionType,
} from "@/types/music";

type ChordChartPreviewProps = {
  chart: ChordChart;
};

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  intro: "Introdução",
  verse: "Verso",
  preChorus: "Pré-refrão",
  chorus: "Refrão",
  bridge: "Ponte",
  instrumental: "Instrumental",
  solo: "Solo",
  ending: "Final",
};

function hasLyricsContent(section: Section): section is Section & { content: LyricsSectionContent } {
  return "lines" in section.content;
}

function hasGridContent(section: Section): section is Section & { content: GridSectionContent } {
  return "measures" in section.content;
}

function transpose(symbol: string, semitones: number, key: string): string {
  return transposeChord(symbol, semitones, { key });
}

function LyricsLine({
  line,
  semitones,
  chartKey,
}: {
  line: LyricsSectionContent["lines"][number];
  semitones: number;
  chartKey: string;
}) {
  const chordLine = line.chords
    .map((chord) => `${" ".repeat(chord.position)}${transpose(chord.symbol, semitones, chartKey)}`)
    .join("");

  return (
    <div className="space-y-0.5">
      <pre className="music-chords overflow-x-auto whitespace-pre">{chordLine || " "}</pre>
      <pre className="music-lyrics overflow-x-auto whitespace-pre">{line.text}</pre>
    </div>
  );
}

function LyricsChart({ chart, semitones }: { chart: ChordChart; semitones: number }) {
  return (
    <div className="space-y-6">
      {chart.sections.filter(hasLyricsContent).map((section) => (
        <section key={section.id}>
          <h3 className="ds-eyebrow mb-3 text-content-subtle">
            {section.label}
          </h3>
          <p className="mb-2 text-xs text-content-muted">
            Tipo: {SECTION_TYPE_LABELS[section.type]}
          </p>
          <div className="space-y-2">
            {section.content.lines.map((line, index) => (
              <LyricsLine key={`${section.id}-${index}`} line={line} semitones={semitones} chartKey={chart.key} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GridChart({ chart, semitones }: { chart: ChordChart; semitones: number }) {
  return (
    <div className="space-y-6">
      {chart.sections.filter(hasGridContent).map((section) => (
        <section key={section.id}>
          <h3 className="ds-eyebrow mb-3 text-content-subtle">
            {section.label}
          </h3>
          <p className="mb-2 text-xs text-content-muted">
            Tipo: {SECTION_TYPE_LABELS[section.type]}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {section.content.measures.map((measure) => (
              <div
                key={`${section.id}-${measure.index}`}
                className="music-measure"
              >
                {measure.chords
                  .map((chord) => transpose(chord.symbol, semitones, chart.key))
                  .join("  ")}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ChordChartPreview({ chart }: ChordChartPreviewProps) {
  const [semitones, setSemitones] = useState(0);

  return (
    <article className="ds-card p-5">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {chart.format === "lyrics" ? "Cifra com letra" : "Grade por compassos"}
          </p>
          <h2 className="text-xl font-semibold text-content">{chart.title ?? "Exemplo de cifra"}</h2>
          <p className="text-sm text-content-muted">
            Tom base {chart.key} · {chart.timeSignature}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemitones((value) => value - 1)}
            className="ds-button-secondary px-3 py-2"
          >
            -1
          </button>
          <span className="min-w-20 rounded-full bg-surface-muted px-3 py-2 text-center text-sm font-medium text-content-muted">
            {semitones > 0 ? `+${semitones}` : semitones}
          </span>
          <button
            type="button"
            onClick={() => setSemitones((value) => value + 1)}
            className="ds-button-secondary px-3 py-2"
          >
            +1
          </button>
        </div>
      </div>

      <div className="mt-6">
        {chart.format === "lyrics" ? (
          <LyricsChart chart={chart} semitones={semitones} />
        ) : (
          <GridChart chart={chart} semitones={semitones} />
        )}
      </div>
    </article>
  );
}
