import type { ImportDraft } from "@/types/import";
import type { ChordChart, Section, SectionType } from "@/types/music";

export type ApplyEditedChartInput = {
  existing: ChordChart;
  key: string;
  capo?: number;
  sectionTypes: Record<string, SectionType>;
  parsed?: ImportDraft;
};

function applySectionTypes(
  sections: Section[],
  sectionTypes: Record<string, SectionType>,
): Section[] {
  return sections.map((section) => {
    const type = sectionTypes[section.id];
    return type ? { ...section, type } : section;
  });
}

export function applyEditedChart(input: ApplyEditedChartInput): ChordChart {
  const { existing, key, capo, sectionTypes, parsed } = input;

  const base: ChordChart = {
    id: existing.id,
    songId: existing.songId,
    title: existing.title,
    ...(existing.versionLabel ? { versionLabel: existing.versionLabel } : {}),
    format: existing.format,
    timeSignature: existing.timeSignature,
    tempo: existing.tempo,
    origin: existing.origin,
    key,
    sections: [],
  };

  if (capo !== undefined && capo > 0) {
    base.capo = capo;
  }

  if (parsed) {
    return {
      ...base,
      source: parsed.chart.source ?? parsed.rawText,
      sections: applySectionTypes(parsed.chart.sections, sectionTypes),
    };
  }

  return {
    ...base,
    source: existing.source,
    sections: applySectionTypes(existing.sections, sectionTypes),
  };
}
