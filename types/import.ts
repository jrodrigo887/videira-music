import type { ChordChart, Song } from "@/types/music";

export type ImportOriginKind = "paste" | "file" | "url";

export type ImportOrigin = {
  kind: ImportOriginKind;
  url?: string;
  sourceName?: string;
  fetchedAt?: string;
};

export type ImportWarningCode =
  | "TAB_REMOVED"
  | "UNKNOWN_SECTION"
  | "CHORD_UNPARSED"
  | "ORPHAN_CHORD_LINE"
  | "KEY_GUESSED"
  | "KEY_MISMATCH"
  | "EMPTY_INPUT";

export type ImportErrorCode =
  | "UNSUPPORTED_SOURCE"
  | "SOURCE_BLOCKED"
  | "SOURCE_LAYOUT_CHANGED"
  | "SOURCE_TIMEOUT";

export type ImportWarning = {
  code: ImportWarningCode;
  line?: number;
  message: string;
};

export type RawChartMeta = {
  title?: string;
  artist?: string;
  composers?: string[];
  genre?: string;
  key?: string;
  keyLabel?: string;
  capo?: number;
  capoLabel?: string;
  youtubeUrl?: string;
};

export type RawChart = {
  text: string;
  /** Acordes marcados na fonte (ex.: `<b data-chord-name>` do Cifra Club), na ordem em que aparecem no texto. */
  chordTokens?: string[];
  meta: RawChartMeta;
  origin: ImportOrigin;
};

export type ImportDraft = {
  id: string;
  origin: ImportOrigin;
  rawText: string;
  song: Partial<Pick<Song, "title" | "artist" | "defaultKey">>;
  chart: Omit<ChordChart, "id" | "songId">;
  warnings: ImportWarning[];
  stats: {
    sections: number;
    lyricLines: number;
    chords: number;
    linesIgnored: number;
  };
};
