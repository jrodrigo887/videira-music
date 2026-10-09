import type { ChordChart, Measure, Section, SongId } from "@/types/music";

type GridChartInput = {
  id: string;
  songId: SongId;
  source: string;
  key?: string;
};

const SECTION_PATTERN = /^\[([^\]]+)\]$/;

function sectionId(label: string, index: number): string {
  return `${label.toLocaleLowerCase("pt-BR").replaceAll(/\s+/g, "-")}-${index}`;
}

function sectionType(label: string): Section["type"] {
  const normalized = label.toLocaleLowerCase("pt-BR");

  if (normalized.includes("intro")) return "intro";
  if (normalized.includes("refr")) return "chorus";
  if (normalized.includes("ponte")) return "bridge";
  if (normalized.includes("solo")) return "solo";
  if (normalized.includes("fim") || normalized.includes("ending")) return "ending";
  if (normalized.includes("instrumental")) return "instrumental";

  return "verse";
}

function parseMeasures(line: string, startIndex: number): Measure[] {
  return line
    .split("|")
    .map((measure) => measure.trim())
    .filter(Boolean)
    .map((measure, index) => ({
      index: startIndex + index,
      chords: measure.split(/\s+/).map((symbol) => ({ symbol })),
    }));
}

export function parseGridChart(input: GridChartInput): ChordChart {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const rawLine of input.source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const heading = line.match(SECTION_PATTERN);

    if (heading) {
      const label = heading[1];
      currentSection = {
        id: sectionId(label, sections.length + 1),
        type: sectionType(label),
        label,
        content: { measures: [] },
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = {
        id: "section-1",
        type: "verse",
        label: "Grade",
        content: { measures: [] },
      };
      sections.push(currentSection);
    }

    const measures = parseMeasures(line, currentSection.content.measures.length);
    currentSection.content.measures.push(...measures);
  }

  return {
    id: input.id,
    songId: input.songId,
    format: "grid",
    key: input.key ?? "C",
    timeSignature: "4/4",
    sections,
    source: input.source,
  };
}
