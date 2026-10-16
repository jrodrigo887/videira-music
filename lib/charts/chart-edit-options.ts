import type { SectionType } from "@/types/music";

export const TONALITY_OPTIONS: readonly string[] = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
  "Cm",
  "C#m",
  "Dbm",
  "Dm",
  "D#m",
  "Ebm",
  "Em",
  "Fm",
  "F#m",
  "Gbm",
  "Gm",
  "G#m",
  "Abm",
  "Am",
  "A#m",
  "Bbm",
  "Bm",
];

export const SECTION_TYPE_OPTIONS: { value: SectionType; label: string }[] = [
  { value: "intro", label: "Introdução" },
  { value: "verse", label: "Verso" },
  { value: "preChorus", label: "Pré-refrão" },
  { value: "chorus", label: "Refrão" },
  { value: "bridge", label: "Ponte" },
  { value: "instrumental", label: "Instrumental" },
  { value: "solo", label: "Solo" },
  { value: "ending", label: "Final" },
];

const TONALITY_SET = new Set<string>(TONALITY_OPTIONS);

export function isEditableChartKey(key: string): boolean {
  return TONALITY_SET.has(key);
}
