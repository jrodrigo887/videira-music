import { assembleSections } from "@/lib/import/assemble-sections";
import { classifyLines, type ClassifiedLine } from "@/lib/import/classify-lines";
import { detectKey } from "@/lib/import/detect-key";
import { normalizeText } from "@/lib/import/normalize-text";
import { matchSectionType, resolveSectionType } from "@/lib/import/section-type";
import type { ImportDraft, ImportOrigin, ImportWarning } from "@/types/import";
import type { ChordChart, Song } from "@/types/music";

export type PreviewImportInput = {
  text: string;
  origin?: ImportOrigin;
  hints?: {
    key?: string;
    title?: string;
    artist?: string;
  };
};

const DEFAULT_ORIGIN: ImportOrigin = { kind: "paste" };

function warningForLine(lines: ClassifiedLine[], index: number): ImportWarning | undefined {
  const line = lines[index];

  if (
    (line.kind === "sectionHeader" || line.kind === "sectionHeaderWithChords") &&
    !matchSectionType(line.label ?? "")
  ) {
    return {
      code: "UNKNOWN_SECTION",
      line: line.lineNumber,
      message: `Seção "${line.label}" não reconhecida; importada como verso.`,
    };
  }

  if (line.kind === "tabLine" || line.kind === "tabMeta") {
    return {
      code: "TAB_REMOVED",
      line: line.lineNumber,
      message: "Linha de tablatura removida do preview; o conteúdo permanece no texto original.",
    };
  }

  if (line.kind === "chordLine" && lines[index + 1]?.kind !== "lyric") {
    return {
      code: "ORPHAN_CHORD_LINE",
      line: line.lineNumber,
      message: "Linha de acordes sem letra associada; importada como passagem instrumental.",
    };
  }

  return undefined;
}

function collectWarnings(lines: ClassifiedLine[]): ImportWarning[] {
  return lines.flatMap((_, index) => {
    const warning = warningForLine(lines, index);
    return warning ? [warning] : [];
  });
}

function countChart(sections: ChordChart["sections"], linesIgnored: number): ImportDraft["stats"] {
  const lyricLines = sections.flatMap((section) =>
    "lines" in section.content ? section.content.lines : [],
  );

  return {
    sections: sections.length,
    lyricLines: lyricLines.length,
    chords: lyricLines.reduce((total, line) => total + line.chords.length, 0),
    linesIgnored,
  };
}

function songMetadata(
  hints: PreviewImportInput["hints"],
  detectedKey: string | undefined,
): ImportDraft["song"] {
  const song: Partial<Pick<Song, "title" | "artist" | "defaultKey">> = {};

  if (hints?.title) song.title = hints.title;
  if (hints?.artist) song.artist = hints.artist;
  if (detectedKey) song.defaultKey = detectedKey;

  return song;
}

export function previewImport(input: PreviewImportInput): ImportDraft {
  const origin = input.origin ?? DEFAULT_ORIGIN;
  const classified = classifyLines(normalizeText(input.text));
  const assembled = assembleSections(classified.lines, { resolveSectionType });
  const keyDetection = detectKey({
    sections: assembled.sections,
    lines: classified.lines,
    hints: { key: input.hints?.key },
  });
  const chart: ImportDraft["chart"] = {
    ...(input.hints?.title ? { title: input.hints.title } : {}),
    format: "lyrics",
    key: keyDetection.key ?? "C",
    timeSignature: "4/4",
    ...(keyDetection.capo ? { capo: keyDetection.capo } : {}),
    sections: assembled.sections,
    source: input.text,
    origin,
  };
  const warnings = collectWarnings(classified.lines);

  if (!input.text.trim()) {
    warnings.push({
      code: "EMPTY_INPUT",
      message: "Nenhum conteúdo foi informado para importação.",
    });
  }

  warnings.push(...keyDetection.warnings);

  return {
    id: `import-${crypto.randomUUID()}`,
    origin,
    rawText: input.text,
    song: songMetadata(input.hints, keyDetection.key),
    chart,
    warnings,
    stats: countChart(assembled.sections, assembled.ignoredLines.length),
  };
}
