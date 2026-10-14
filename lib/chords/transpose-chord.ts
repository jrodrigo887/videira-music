import { parseChord } from "./parse-chord";

export const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);

export type TransposeOptions = {
  preferFlats?: boolean;
  key?: string;
};

function noteIndex(note: string): number {
  const sharpIndex = SHARP_NOTES.indexOf(note);

  if (sharpIndex >= 0) {
    return sharpIndex;
  }

  return FLAT_NOTES.indexOf(note);
}

function normalizeIndex(index: number): number {
  return ((index % 12) + 12) % 12;
}

/** Root pitch class from a key label such as `G`, `Am` or `F#`. */
export function parseKeyRoot(key: string): string | undefined {
  const match = key.trim().match(/^([A-G](?:#|b)?)/);
  return match?.[1];
}

const CHROMATIC_ROOTS = new Set([...SHARP_NOTES, ...FLAT_NOTES]);

/** True when the key is a supported major or minor root (SET-05). */
export function isTransposableKey(key: string): boolean {
  const trimmed = key.trim();
  const root = parseKeyRoot(trimmed);
  if (!root || !CHROMATIC_ROOTS.has(root)) {
    return false;
  }
  const suffix = trimmed.slice(root.length);
  return suffix === "" || suffix === "m";
}

/** Semitone steps to transpose from `fromKey` so its root matches `toKey`. */
export function semitonesBetweenKeys(fromKey: string, toKey: string): number {
  const fromRoot = parseKeyRoot(fromKey);
  const toRoot = parseKeyRoot(toKey);
  if (!fromRoot || !toRoot) {
    return 0;
  }

  const fromIndex = noteIndex(fromRoot);
  const toIndex = noteIndex(toRoot);
  if (fromIndex < 0 || toIndex < 0) {
    return 0;
  }

  return normalizeIndex(toIndex - fromIndex);
}

function shouldUseFlats(note: string, options?: TransposeOptions): boolean {
  if (options?.preferFlats !== undefined) {
    return options.preferFlats;
  }

  if (options?.key && FLAT_KEYS.has(options.key)) {
    return true;
  }

  return note.includes("b");
}

function transposeNote(note: string, semitones: number, options?: TransposeOptions): string {
  const index = noteIndex(note);

  if (index < 0) {
    return note;
  }

  const notes = shouldUseFlats(note, options) ? FLAT_NOTES : SHARP_NOTES;
  return notes[normalizeIndex(index + semitones)];
}

export function transposeChord(
  chordSymbol: string,
  semitones: number,
  options?: TransposeOptions,
): string {
  const chord = parseChord(chordSymbol);

  if (!chord) {
    return chordSymbol;
  }

  const root = transposeNote(chord.root, semitones, options);
  const bass = chord.bass ? `/${transposeNote(chord.bass, semitones, options)}` : "";

  return `${root}${chord.quality}${bass}`;
}
