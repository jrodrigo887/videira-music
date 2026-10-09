import type { ParsedChord } from "@/types/music";

const CHORD_PATTERN = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;

export function parseChord(input: string): ParsedChord | null {
  const raw = input.trim();
  const match = raw.match(CHORD_PATTERN);

  if (!match) {
    return null;
  }

  const [, root, quality, bass] = match;

  return {
    raw,
    root,
    quality,
    ...(bass ? { bass } : {}),
  };
}
