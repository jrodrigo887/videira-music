"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { parseChord } from "@/lib/chords/parse-chord";
import { semitonesBetweenKeys, transposeChord } from "@/lib/chords/transpose-chord";
import { chartDisplayStyle, type ChartDisplaySettings } from "@/lib/songs/chart-display-preference";
import type {
  ChordChart,
  GridSectionContent,
  LyricsSectionContent,
  Section,
  SectionType,
} from "@/types/music";

type ChordChartPreviewProps = {
  chart: ChordChart;
  semitones?: number;
  onSemitonesChange?: (next: number) => void;
  showDiagrams?: boolean;
  columns?: 1 | 2;
  displaySettings?: ChartDisplaySettings;
  /** Standalone card with transpose controls; embedded is for song detail unified header. */
  layout?: "standalone" | "embedded";
  showFormatTags?: boolean;
  showTransposeControls?: boolean;
  showKeyMetadata?: boolean;
  /** When set, Tom label and sidebar share this base; chords offset from chart.key. */
  syncDisplayKeyBase?: string;
};

type ChordVoicing = {
  baseFret?: number;
  frets: [number, number, number, number, number, number];
  fingers?: [number, number, number, number, number, number];
  barre?: { fret: number; fromString: number; toString: number };
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

const CHORD_VOICINGS: Record<string, ChordVoicing> = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  C9: { frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
  Cm: { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  "C#": { baseFret: 4, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  "C#m": { baseFret: 4, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  "C#m7": { baseFret: 4, frets: [-1, 1, 3, 1, 2, 1], fingers: [0, 1, 3, 1, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  D9: { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
  "D6(9)": { baseFret: 5, frets: [-1, 1, 0, 1, 1, 0], fingers: [0, 1, 0, 2, 3, 0] },
  "D/F#": { frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  Eb: { baseFret: 6, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  "E/G#": { frets: [4, 2, 2, 1, 0, 0], fingers: [4, 2, 3, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Em7: { frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  Fm: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  "F#": { baseFret: 2, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  "F#m": { baseFret: 2, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  "F#m7": { baseFret: 2, frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  G: { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4] },
  "G/B": { frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4] },
  Gm: { baseFret: 3, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  "G#": { baseFret: 4, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  "G#m": { baseFret: 4, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 1, fromString: 0, toString: 5 } },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  A9: { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Bb: { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  Bbm: { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  B: { baseFret: 2, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  Bm: { baseFret: 2, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  Bm7: { baseFret: 2, frets: [-1, 1, 3, 1, 2, 1], fingers: [0, 1, 3, 1, 2, 1], barre: { fret: 1, fromString: 1, toString: 5 } },
  Bm11: { frets: [-1, 2, 0, 2, 2, 0], fingers: [0, 1, 0, 2, 3, 0] },
};

function resolveVoicing(symbol: string): ChordVoicing {
  if (CHORD_VOICINGS[symbol]) {
    return CHORD_VOICINGS[symbol];
  }

  const parsed = parseChord(symbol);
  if (parsed) {
    const isMinor = parsed.quality.startsWith("m") && !parsed.quality.startsWith("maj");
    const triadKey = `${parsed.root}${isMinor ? "m" : ""}`;
    if (CHORD_VOICINGS[triadKey]) {
      return CHORD_VOICINGS[triadKey];
    }
    if (CHORD_VOICINGS[parsed.root]) {
      return CHORD_VOICINGS[parsed.root];
    }
  }

  return CHORD_VOICINGS.C;
}

function hasLyricsContent(section: Section): section is Section & { content: LyricsSectionContent } {
  return "lines" in section.content;
}

function hasGridContent(section: Section): section is Section & { content: GridSectionContent } {
  return "measures" in section.content;
}

function transpose(symbol: string, semitones: number, key: string): string {
  return transposeChord(symbol, semitones, { key });
}

function extractUniqueChords(chart: ChordChart, semitones: number): string[] {
  const seen = new Set<string>();

  for (const section of chart.sections) {
    if (hasLyricsContent(section)) {
      for (const line of section.content.lines) {
        for (const chord of line.chords) {
          seen.add(transpose(chord.symbol, semitones, chart.key));
        }
      }
    } else if (hasGridContent(section)) {
      for (const measure of section.content.measures) {
        for (const chord of measure.chords) {
          seen.add(transpose(chord.symbol, semitones, chart.key));
        }
      }
    }
  }

  return Array.from(seen);
}

const CHEVRON_PATHS = {
  left: "M10 4 6 8 10 12",
  right: "M6 4 10 8 6 12",
  down: "M4 6 8 10 12 6",
  up: "M4 10 8 6 12 10",
} as const;

function ChevronIcon({ direction }: { direction: keyof typeof CHEVRON_PATHS }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="text-current"
    >
      <path
        d={CHEVRON_PATHS[direction]}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SCROLLBAR_HIDDEN =
  "overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function ChordDiagramsStrip({
  chords,
  className,
}: {
  chords: string[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    hasOverflow: false,
  });

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = element;
    const hasOverflow = scrollWidth > clientWidth + 1;
    setScrollState({
      hasOverflow,
      canScrollLeft: hasOverflow && scrollLeft > 1,
      canScrollRight: hasOverflow && scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    if (expanded) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(element);
    }

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [chords, expanded, updateScrollState]);

  function scrollByDirection(direction: -1 | 1) {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const step = Math.max(element.clientWidth * 0.75, 160);
    element.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  const scrollButtonClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-content shadow-xs transition enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-default disabled:opacity-35";

  const showExpandControl = expanded || scrollState.hasOverflow;

  return (
    <div className={className}>
      {showExpandControl ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded ? "Recolher diagramas de acordes" : "Expandir diagramas de acordes"
            }
            className={scrollButtonClass}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronIcon direction={expanded ? "up" : "down"} />
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="rounded-2xl border border-border bg-surface-muted/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-6">
            {chords.map((symbol) => (
              <ChordDiagramCard key={symbol} symbol={symbol} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-1.5">
          {scrollState.hasOverflow ? (
            <button
              type="button"
              aria-label="Rolar acordes para a esquerda"
              className={`${scrollButtonClass} self-center`}
              disabled={!scrollState.canScrollLeft}
              onClick={() => scrollByDirection(-1)}
            >
              <ChevronIcon direction="left" />
            </button>
          ) : null}

          <div
            ref={scrollRef}
            className={`flex min-w-0 flex-1 items-center gap-4 ${SCROLLBAR_HIDDEN}`}
          >
            {chords.map((symbol) => (
              <ChordDiagramCard key={symbol} symbol={symbol} />
            ))}
          </div>

          {scrollState.hasOverflow ? (
            <button
              type="button"
              aria-label="Rolar acordes para a direita"
              className={`${scrollButtonClass} self-center`}
              disabled={!scrollState.canScrollRight}
              onClick={() => scrollByDirection(1)}
            >
              <ChevronIcon direction="right" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ChordDiagramCard({ symbol }: { symbol: string }) {
  const voicing = resolveVoicing(symbol);
  const baseFret = voicing.baseFret ?? 1;
  const stringX = (index: number) => 16 + index * 9;
  const fretY = (fretIndex: number) => 10 + fretIndex * 12;

  return (
    <div className="flex shrink-0 flex-col items-center">
      <span className="mb-1.5 font-chord text-xs font-bold text-primary">
        {symbol}
      </span>
      <svg
        width="74"
        height="86"
        viewBox="0 0 74 86"
        aria-hidden="true"
        className="text-content"
      >
        {baseFret === 1 ? (
          <line x1={15.5} y1={10} x2={61.5} y2={10} stroke="currentColor" strokeWidth="3" />
        ) : (
          <text
            x="6"
            y="20"
            fontSize="9"
            fontWeight="600"
            fill="hsl(var(--color-content-subtle))"
          >
            {baseFret}
          </text>
        )}

        {[0, 1, 2, 3, 4, 5].map((f) => (
          <line
            key={`fret-${f}`}
            x1={16}
            y1={fretY(f)}
            x2={61}
            y2={fretY(f)}
            stroke="hsl(var(--color-border-strong))"
            strokeWidth={f === 0 && baseFret === 1 ? "0" : "1"}
          />
        ))}

        {[0, 1, 2, 3, 4, 5].map((s) => (
          <line
            key={`string-${s}`}
            x1={stringX(s)}
            y1={10}
            x2={stringX(s)}
            y2={70}
            stroke="hsl(var(--color-content-muted))"
            strokeWidth="1"
          />
        ))}

        {voicing.barre ? (
          <rect
            x={stringX(voicing.barre.fromString) - 3}
            y={fretY(voicing.barre.fret) - 9}
            width={stringX(voicing.barre.toString) - stringX(voicing.barre.fromString) + 6}
            height="6"
            rx="3"
            fill="currentColor"
          />
        ) : null}

        {voicing.frets.map((fret, stringIndex) => {
          const x = stringX(stringIndex);
          if (fret <= 0) {
            return (
              <text
                key={`marker-${stringIndex}`}
                x={x}
                y="81"
                textAnchor="middle"
                fontSize="8"
                fontWeight="600"
                fill="hsl(var(--color-content-subtle))"
              >
                {fret === -1 ? "×" : "○"}
              </text>
            );
          }

          if (
            voicing.barre &&
            fret === voicing.barre.fret &&
            stringIndex >= voicing.barre.fromString &&
            stringIndex <= voicing.barre.toString
          ) {
            return null;
          }

          const y = fretY(fret) - 6;
          const finger = voicing.fingers?.[stringIndex];

          return (
            <g key={`dot-${stringIndex}`}>
              <circle cx={x} cy={y} r="4.2" fill="currentColor" />
              {finger ? (
                <text
                  x={x}
                  y={y + 2.5}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontWeight="700"
                  fill="hsl(var(--color-surface))"
                >
                  {finger}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type MusicSegment = {
  chord: string;
  lyric: string;
};

function buildMusicSegments(
  text: string,
  chords: LyricsSectionContent["lines"][number]["chords"],
  semitones: number,
  chartKey: string,
): MusicSegment[] {
  if (chords.length === 0) {
    return [{ chord: "", lyric: text }];
  }

  const grouped = new Map<number, string[]>();
  for (const placement of chords) {
    const position = Math.max(0, Math.floor(placement.position));
    const symbols = grouped.get(position) ?? [];
    symbols.push(transpose(placement.symbol, semitones, chartKey));
    grouped.set(position, symbols);
  }

  const positions = Array.from(grouped.keys()).sort((left, right) => left - right);
  const paddedText = text.padEnd(Math.max(text.length, positions.at(-1) ?? 0), " ");
  const segments: MusicSegment[] = [];

  if (positions[0] > 0) {
    segments.push({ chord: "", lyric: paddedText.slice(0, positions[0]) });
  }

  positions.forEach((position, index) => {
    const nextPosition = positions[index + 1] ?? paddedText.length;
    segments.push({
      chord: grouped.get(position)?.join(" ") ?? "",
      lyric: paddedText.slice(position, nextPosition),
    });
  });

  return segments;
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
  const segments = buildMusicSegments(line.text, line.chords, semitones, chartKey);

  return (
    <div className="music-line">
      {segments.map((segment, index) => (
        <span
          key={index}
          className="music-segment"
        >
          <span className="music-chords">{segment.chord || "\u00a0"}</span>
          <span className="music-lyrics">{segment.lyric || "\u00a0"}</span>
        </span>
      ))}
    </div>
  );
}

function LyricsChart({
  chart,
  semitones,
  columns = 1,
}: {
  chart: ChordChart;
  semitones: number;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={
        columns === 2 ? "music-sections grid gap-x-8 md:grid-cols-2" : "music-sections flex flex-col"
      }
    >
      {chart.sections.filter(hasLyricsContent).map((section) => (
        <section key={section.id}>
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <h3 className="font-bold text-content before:content-['['] after:content-[']']">
              {section.label}
            </h3>
            <p className="rounded-full bg-surface-muted px-2.5 py-0.5 font-lyrics text-xs font-medium tracking-normal text-content-subtle">
              Tipo: {SECTION_TYPE_LABELS[section.type]}
            </p>
          </div>
          <div className="music-lines">
            {section.content.lines.map((line, index) => (
              <LyricsLine
                key={`${section.id}-${index}`}
                line={line}
                semitones={semitones}
                chartKey={chart.key}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GridChart({ chart, semitones }: { chart: ChordChart; semitones: number }) {
  return (
    <div className="music-sections flex flex-col">
      {chart.sections.filter(hasGridContent).map((section) => (
        <section key={section.id}>
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <h3 className="font-bold text-content before:content-['['] after:content-[']']">
              {section.label}
            </h3>
            <p className="rounded-full bg-surface-muted px-2.5 py-0.5 font-lyrics text-xs font-medium tracking-normal text-content-subtle">
              Tipo: {SECTION_TYPE_LABELS[section.type]}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

export function ChordChartPreview({
  chart,
  semitones: controlledSemitones,
  onSemitonesChange,
  showDiagrams = true,
  columns = 1,
  displaySettings,
  layout = "standalone",
  showFormatTags: showFormatTagsProp,
  showTransposeControls: showTransposeControlsProp,
  showKeyMetadata: showKeyMetadataProp,
  syncDisplayKeyBase,
}: ChordChartPreviewProps) {
  const [internalSemitones, setInternalSemitones] = useState(0);
  const semitones = controlledSemitones ?? internalSemitones;
  const chartKeyOffset = syncDisplayKeyBase
    ? semitonesBetweenKeys(chart.key, syncDisplayKeyBase)
    : 0;
  const renderSemitones = semitones + chartKeyOffset;
  const embedded = layout === "embedded";
  const showFormatTags = showFormatTagsProp ?? !embedded;
  const showTransposeControls = showTransposeControlsProp ?? true;
  const showKeyMetadata = showKeyMetadataProp ?? !embedded;

  function updateSemitones(delta: number) {
    const next = semitones + delta;
    if (onSemitonesChange) {
      onSemitonesChange(next);
    } else {
      setInternalSemitones(next);
    }
  }

  const activeKey = syncDisplayKeyBase
    ? transposeChord(syncDisplayKeyBase, semitones, { key: syncDisplayKeyBase })
    : transpose(chart.key, semitones, chart.key);
  const uniqueChords = extractUniqueChords(chart, renderSemitones);
  const Wrapper = embedded ? "div" : "article";
  const chartTitle = chart.title?.trim();

  const showChartHeader =
    showFormatTags || !embedded || Boolean(chartTitle) || showTransposeControls;
  const embeddedHeaderOnlyKey =
    embedded && !showFormatTags && !chartTitle && showTransposeControls;
  const chartBodyClassName = [
    "music-chart max-w-full overflow-x-auto pb-2",
    embedded && !showChartHeader && !(showDiagrams && uniqueChords.length > 0)
      ? undefined
      : embedded
        ? "mt-5"
        : "mt-6",
  ].filter(Boolean).join(" ");

  return (
    <Wrapper className={embedded ? undefined : "ds-card p-6 sm:p-8"}>
      {showChartHeader ? (
      <div
        className={
          embedded
            ? embeddedHeaderOnlyKey
              ? "flex justify-end border-b border-border pb-4"
              : "flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between"
            : "flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        {!embeddedHeaderOnlyKey ? (
        <div>
          {showFormatTags ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-content px-3 py-1 text-xs font-semibold text-content-inverse">
                {chart.format === "lyrics" ? "Cifra com letra" : "Grade por compassos"}
              </span>
              <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
                Compasso {chart.timeSignature}
              </span>
              {chart.capo ? (
                <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-muted">
                  Capo {chart.capo}ª
                </span>
              ) : null}
            </div>
          ) : null}
          {!embedded || chartTitle ? (
            <h2 className={showFormatTags ? "mt-2.5 text-lg font-bold text-content" : "text-lg font-bold text-content"}>
              {chartTitle ?? "Exemplo de cifra"}
            </h2>
          ) : null}
        </div>
        ) : null}

        {showTransposeControls ? (
          <div className="flex items-center gap-1.5 self-start rounded-full border border-border bg-surface-muted/60 p-1 sm:self-auto">
            <button
              type="button"
              onClick={() => updateSemitones(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-bold text-content shadow-xs transition hover:border-primary hover:text-primary"
            >
              -1
            </button>
            <span className="min-w-16 px-2 text-center text-xs font-bold text-content">
              {semitones === 0
                ? `Tom ${activeKey}`
                : `${activeKey} (${semitones > 0 ? `+${semitones}` : semitones})`}
            </span>
            <button
              type="button"
              onClick={() => updateSemitones(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-bold text-content shadow-xs transition hover:border-primary hover:text-primary"
            >
              +1
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      {showDiagrams && uniqueChords.length > 0 ? (
        <ChordDiagramsStrip
          chords={uniqueChords}
          className={
            embedded && !showChartHeader
              ? "border-b border-border pb-5"
              : embedded
                ? "mt-5 border-b border-border pb-5"
                : "mt-6 border-b border-border pb-5"
          }
        />
      ) : null}

      {showKeyMetadata ? (
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-content-muted">
          <p>
            Tom: <strong className="font-bold text-primary">{activeKey}</strong>
          </p>
          {semitones !== 0 ? (
            <p className="text-xs text-content-subtle">
              Original: {chart.key}
            </p>
          ) : null}
          {chart.capo ? (
            <p className="text-xs text-content-subtle">
              Capotraste: {chart.capo}ª casa
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={chartBodyClassName}
        style={displaySettings ? chartDisplayStyle(displaySettings) : undefined}
      >
        {chart.format === "lyrics" ? (
          <LyricsChart chart={chart} semitones={renderSemitones} columns={columns} />
        ) : (
          <GridChart chart={chart} semitones={renderSemitones} />
        )}
      </div>
    </Wrapper>
  );
}
