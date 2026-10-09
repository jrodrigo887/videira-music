const ROOT = "[A-G](?:#|b)?";
const QUALITY_UNIT = "(?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\\+|-|#|b|\\d|\\(|\\)|,)";
const BASS = `(?:${ROOT}|\\d+)`;
const CHORD_SYMBOL = new RegExp(`^${ROOT}${QUALITY_UNIT}*(?:/${BASS})?$`);

/**
 * Mais estrito que `parseChord`, que aceita qualquer sufixo (`Deus`, `Cedo`, `Bem`).
 * Usado para decidir se uma linha de texto colado e linha de acordes.
 */
export function isChordSymbol(token: string): boolean {
  return CHORD_SYMBOL.test(token);
}
