"use client";

import { useState } from "react";

import { transposeChord } from "@/lib/chords/transpose-chord";
import type { ChordChart, GridSectionContent, LyricsSectionContent, Section } from "@/types/music";

type ChordChartPreviewProps = {
  chart: ChordChart;
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
    <div className="font-mono text-sm leading-7">
      <pre className="overflow-x-auto whitespace-pre text-leaf-700">{chordLine || " "}</pre>
      <pre className="overflow-x-auto whitespace-pre text-slate-950">{line.text}</pre>
    </div>
  );
}

function LyricsChart({ chart, semitones }: { chart: ChordChart; semitones: number }) {
  return (
    <div className="space-y-6">
      {chart.sections.filter(hasLyricsContent).map((section) => (
        <section key={section.id}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {section.label}
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {section.label}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {section.content.measures.map((measure) => (
              <div
                key={`${section.id}-${measure.index}`}
                className="min-h-16 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm font-semibold text-slate-950"
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
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-leaf-700">
            {chart.format === "lyrics" ? "Cifra com letra" : "Grade por compassos"}
          </p>
          <h2 className="text-xl font-semibold text-slate-950">{chart.title ?? "Exemplo de cifra"}</h2>
          <p className="text-sm text-slate-600">
            Tom base {chart.key} · {chart.timeSignature}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemitones((value) => value - 1)}
            className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-leaf-500 hover:text-leaf-700"
          >
            -1
          </button>
          <span className="min-w-20 rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-700">
            {semitones > 0 ? `+${semitones}` : semitones}
          </span>
          <button
            type="button"
            onClick={() => setSemitones((value) => value + 1)}
            className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-leaf-500 hover:text-leaf-700"
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
