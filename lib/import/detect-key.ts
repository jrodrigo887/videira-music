import { parseChord } from "@/lib/chords/parse-chord";
import { transposeChord } from "@/lib/chords/transpose-chord";
import type { ClassifiedLine } from "@/lib/import/classify-lines";
import type { ImportWarning, RawChartMeta } from "@/types/import";
import type { Section } from "@/types/music";

/**
 * `hint`/`directive`: informados por quem escreveu os acordes, usados sem conferir.
 * `meta`: tom da pagina de origem, confirmado pelos acordes.
 * `chords`: sugerido pelo primeiro acorde.
 */
export type KeySource = "hint" | "directive" | "meta" | "chords";

export type DetectKeyInput = {
  sections: Section[];
  /** Linhas classificadas, para ler as diretivas `{key}` e `{capo}`. */
  lines?: ClassifiedLine[];
  meta?: Pick<RawChartMeta, "key" | "keyLabel" | "capo" | "capoLabel">;
  hints?: { key?: string; capo?: number };
};

export type KeyDetection = {
  key?: string;
  keySource?: KeySource;
  capo?: number;
  warnings: ImportWarning[];
};

const KEY_PATTERN = /^\s*([A-Ga-g][#b]?)(m(?!aj))?/;
const SHAPE_PATTERN = /forma\s+de\s+([A-G][#b]?m?)/i;
const NATURAL_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `"C (com forma de A)"` -> `"C"`, `"F#m"` -> `"F#m"`, `"Amin"` -> `"Am"`. */
export function parseKey(value: string | undefined): string | undefined {
  const match = value?.match(KEY_PATTERN);

  if (!match) {
    return undefined;
  }

  const [, root, minor] = match;
  return `${root[0].toUpperCase()}${root.slice(1)}${minor ? "m" : ""}`;
}

/** `"3ª casa"`, `"Capotraste na 2a casa"`, `"2"` -> numero da casa. */
export function parseCapo(value: string | undefined): number | undefined {
  const fret = Number(value?.match(/\d+/)?.[0]);
  return fret > 0 ? fret : undefined;
}

function pitchClass(note: string): number {
  const offset = note.slice(1) === "#" ? 1 : note.slice(1) === "b" ? -1 : 0;
  return (NATURAL_PITCH[note[0]] + offset + 12) % 12;
}

function sameKey(a: string, b: string): boolean {
  const keyA = parseChord(a);
  const keyB = parseChord(b);

  if (!keyA || !keyB) {
    return false;
  }

  return pitchClass(keyA.root) === pitchClass(keyB.root) && keyA.quality === keyB.quality;
}

function firstChord(sections: Section[]): { symbol: string; key: string } | undefined {
  for (const section of sections) {
    if (!("lines" in section.content)) {
      continue;
    }

    for (const line of section.content.lines) {
      for (const { symbol } of line.chords) {
        const chord = parseChord(symbol);

        if (chord) {
          return { symbol, key: `${chord.root}${/^m(?!aj)/.test(chord.quality) ? "m" : ""}` };
        }
      }
    }
  }

  return undefined;
}

function directiveValue(lines: ClassifiedLine[], name: string): string | undefined {
  return lines.find((line) => line.directive?.name === name)?.directive?.value;
}

/**
 * Tons que descrevem os acordes escritos, segundo a pagina: a forma explicita
 * (`"C (com forma de A)"` -> `A`) ou o tom informado, com ou sem o capotraste descontado.
 */
function writtenKeyCandidates(pageKey: string, keyLabel: string | undefined, capo: number | undefined): string[] {
  const shape = parseKey(keyLabel?.match(SHAPE_PATTERN)?.[1]);

  if (shape) {
    return [shape];
  }

  return capo ? [pageKey, transposeChord(pageKey, -capo)] : [pageKey];
}

export function detectKey(input: DetectKeyInput): KeyDetection {
  const lines = input.lines ?? [];
  const meta = input.meta ?? {};
  const capo =
    input.hints?.capo ?? parseCapo(directiveValue(lines, "capo")) ?? meta.capo ?? parseCapo(meta.capoLabel);
  const withCapo = capo ? { capo } : {};

  const hintKey = parseKey(input.hints?.key);
  if (hintKey) {
    return { key: hintKey, keySource: "hint", ...withCapo, warnings: [] };
  }

  const directiveKey = parseKey(directiveValue(lines, "key"));
  if (directiveKey) {
    return { key: directiveKey, keySource: "directive", ...withCapo, warnings: [] };
  }

  const guess = firstChord(input.sections);
  const pageKey = parseKey(meta.key) ?? parseKey(meta.keyLabel);

  if (pageKey) {
    const candidates = writtenKeyCandidates(pageKey, meta.keyLabel, capo);

    if (!guess) {
      return { key: candidates[0], keySource: "meta", ...withCapo, warnings: [] };
    }

    if (candidates.some((candidate) => sameKey(candidate, guess.key))) {
      return { key: guess.key, keySource: "meta", ...withCapo, warnings: [] };
    }

    return {
      key: guess.key,
      keySource: "chords",
      ...withCapo,
      warnings: [
        {
          code: "KEY_MISMATCH",
          message: `O tom informado pela fonte (${meta.keyLabel ?? pageKey}) não bate com os acordes. Sugerido ${guess.key} pelo primeiro acorde (${guess.symbol}); confirme na revisão.`,
        },
      ],
    };
  }

  if (!guess) {
    return { ...withCapo, warnings: [] };
  }

  return {
    key: guess.key,
    keySource: "chords",
    ...withCapo,
    warnings: [
      {
        code: "KEY_GUESSED",
        message: `Tom sugerido pelo primeiro acorde (${guess.symbol}); confirme na revisão.`,
      },
    ],
  };
}
