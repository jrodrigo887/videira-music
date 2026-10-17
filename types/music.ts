import type { ImportOrigin } from "@/types/import";

export type SongId = string;
export type ChordChartId = string;
export type SetlistId = string;

export type ChartFormat = "lyrics" | "grid";

export type SectionType =
  | "intro"
  | "verse"
  | "preChorus"
  | "chorus"
  | "bridge"
  | "instrumental"
  | "solo"
  | "ending";

export type Song = {
  id: SongId;
  title: string;
  label: string;
  artist?: string;
  genre?: string;
  defaultKey?: string;
  alternateKeys: string[];
  notes?: string;
  meta: string;
  /** Letra visível em / e /letras sem login (AUTH-40). */
  publicLyrics?: boolean;
  createdByUserId?: string | null;
};

export type ParsedChord = {
  raw: string;
  root: string;
  quality: string;
  bass?: string;
};

export type ChordPlacement = {
  symbol: string;
  position: number;
};

export type LyricLine = {
  text: string;
  chords: ChordPlacement[];
};

export type MeasureChord = {
  symbol: string;
  beats?: number;
};

export type Measure = {
  index: number;
  beats?: number;
  chords: MeasureChord[];
  repeatStart?: boolean;
  repeatEnd?: boolean;
  ending?: string;
};

export type LyricsSectionContent = {
  lines: LyricLine[];
};

export type GridSectionContent = {
  measures: Measure[];
};

export type Section =
  | {
      id: string;
      type: SectionType;
      label: string;
      repeat?: number;
      content: LyricsSectionContent;
    }
  | {
      id: string;
      type: SectionType;
      label: string;
      repeat?: number;
      content: GridSectionContent;
    };

export type ChordChart = {
  id: ChordChartId;
  songId: SongId;
  title?: string;
  versionLabel?: string;
  format: ChartFormat;
  key: string;
  timeSignature: string;
  tempo?: number;
  capo?: number;
  sections: Section[];
  source?: string;
  origin?: ImportOrigin;
  createdByUserId?: string | null;
};

