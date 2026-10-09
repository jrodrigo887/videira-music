import type { ChordToken, ClassifiedLine, LineKind } from "@/lib/import/classify-lines";
import type { ChordPlacement, LyricLine, Section, SectionType } from "@/types/music";

export type SectionTypeResolver = (label: string) => SectionType;

type AssembleOptions = {
  resolveSectionType?: SectionTypeResolver;
};

export type IgnoredLine = {
  lineNumber: number;
  kind: LineKind;
};

export type AssembleResult = {
  sections: Section[];
  ignoredLines: IgnoredLine[];
};

type SectionDraft = {
  type: SectionType;
  label: string;
  lines: LyricLine[];
  hadTab: boolean;
};

const IMPLICIT_SECTION_LABEL = "Parte 1";

function instrumentalLine(chords: ChordToken[]): LyricLine {
  const firstColumn = chords[0]?.column ?? 0;

  return {
    text: "",
    chords: chords.map((chord) => ({ symbol: chord.symbol, position: chord.column - firstColumn })),
  };
}

function lyricLine(text: string, chords: ChordToken[]): LyricLine {
  const lyric = text.trimStart();
  const indent = text.length - lyric.length;
  const placements: ChordPlacement[] = chords.map((chord) => ({
    symbol: chord.symbol,
    position: Math.max(0, chord.column - indent),
  }));

  return { text: lyric, chords: placements };
}

export function assembleSections(lines: ClassifiedLine[], options: AssembleOptions = {}): AssembleResult {
  const resolveSectionType = options.resolveSectionType ?? (() => "verse");
  const drafts: SectionDraft[] = [];
  const ignoredLines: IgnoredLine[] = [];
  let current: SectionDraft | null = null;
  let pendingChords: ChordToken[] | null = null;

  const startSection = (label: string, type = resolveSectionType(label)): SectionDraft => {
    current = { type, label, lines: [], hadTab: false };
    drafts.push(current);
    return current;
  };

  const section = (): SectionDraft => current ?? startSection(IMPLICIT_SECTION_LABEL, "verse");

  const flushPendingChords = () => {
    if (pendingChords) {
      section().lines.push(instrumentalLine(pendingChords));
      pendingChords = null;
    }
  };

  for (const line of lines) {
    switch (line.kind) {
      case "blank":
        flushPendingChords();
        break;
      case "sectionHeader":
        flushPendingChords();
        startSection(line.label ?? "");
        break;
      case "sectionHeaderWithChords":
        flushPendingChords();
        startSection(line.label ?? "").lines.push(instrumentalLine(line.chords ?? []));
        break;
      case "chordLine":
        flushPendingChords();
        pendingChords = line.chords ?? [];
        break;
      case "lyric":
        section().lines.push(lyricLine(line.text, pendingChords ?? []));
        pendingChords = null;
        break;
      case "tabLine":
      case "tabMeta":
        flushPendingChords();
        section().hadTab = true;
        ignoredLines.push({ lineNumber: line.lineNumber, kind: line.kind });
        break;
      case "repeatMarker":
      case "directive":
        flushPendingChords();
        ignoredLines.push({ lineNumber: line.lineNumber, kind: line.kind });
        break;
    }
  }

  flushPendingChords();

  const sections = drafts
    .filter((draft) => draft.lines.length > 0 || !draft.hadTab)
    .map<Section>((draft, index) => ({
      id: `section-${index + 1}`,
      type: draft.type,
      label: draft.label,
      content: { lines: draft.lines },
    }));

  return { sections, ignoredLines };
}
