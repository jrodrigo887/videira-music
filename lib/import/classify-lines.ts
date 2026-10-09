import { isChordSymbol } from "@/lib/import/chord-symbol";

export type LineKind =
  | "blank"
  | "sectionHeader"
  | "sectionHeaderWithChords"
  | "chordLine"
  | "tabLine"
  | "tabMeta"
  | "repeatMarker"
  | "directive"
  | "lyric";

export type ChordToken = {
  symbol: string;
  column: number;
};

export type ClassifiedLine = {
  /** 1-based, igual a linha do texto original. */
  lineNumber: number;
  kind: LineKind;
  text: string;
  label?: string;
  chords?: ChordToken[];
  directive?: { name: string; value: string };
};

/** `markup`: linhas de acordes vieram dos `<b>` da fonte. `heuristic`: regra de 100% dos tokens. */
export type ChordSignal = "markup" | "heuristic";

export type ClassifyResult = {
  lines: ClassifiedLine[];
  chordSignal: ChordSignal;
  /** Acordes marcados que nao foram encontrados em nenhuma linha de acordes (so no modo `markup`). */
  unmatchedChordTokens: string[];
};

type ClassifyOptions = {
  chordTokens?: string[];
};

const SECTION_HEADER = /^\s*\[([^\]]+)\]\s*(.*)$/;
const DIRECTIVE = /^\s*\{\s*([^:}]+?)\s*(?::\s*(.*?))?\s*\}\s*$/;
const TAB_LINE = /^\s*[A-Ga-g][#b]?\s*\|(?=.*-)[-\dhpbrtvx/\\~|*.()^\s]*$/;
const TAB_META = /^\s*Parte\s+\d+\s+de\s+\d+\s*$/i;
const REPEAT_MARKER = /^\s*\(?\s*(?:\d+\s*x|x\s*\d+|bis)\s*\)?\s*$/i;
const DECORATION = /^(?:-+|\.{2,}|\/|%|\d+x|x\d+)$/i;

/** Quantos `<b>` podem ser pulados para ressincronizar (ex.: acorde marcado dentro de uma linha de letra). */
const MARKUP_LOOKAHEAD = 8;
/** Abaixo disso o texto e os `<b>` nao se alinham (ex.: `innerText` divergente) e a heuristica assume. */
const MIN_MARKUP_COVERAGE = 0.5;

function countChar(value: string, char: string): number {
  return value.split(char).length - 1;
}

function stripDecoration(raw: string): { symbol: string; offset: number } {
  let symbol = raw;
  let offset = 0;

  while (symbol.startsWith("(") || symbol.startsWith("|")) {
    symbol = symbol.slice(1);
    offset += 1;
  }

  while (symbol.endsWith("|") || (symbol.endsWith(")") && countChar(symbol, ")") > countChar(symbol, "("))) {
    symbol = symbol.slice(0, -1);
  }

  return { symbol, offset };
}

/** Tokens nao decorativos da linha, com a coluna absoluta onde cada um comeca. */
function readTokens(text: string, startColumn = 0): ChordToken[] {
  const tokens: ChordToken[] = [];

  for (const match of text.slice(startColumn).matchAll(/\S+/g)) {
    const { symbol, offset } = stripDecoration(match[0]);

    if (!symbol || DECORATION.test(symbol)) {
      continue;
    }

    tokens.push({ symbol, column: startColumn + (match.index ?? 0) + offset });
  }

  return tokens;
}

type ChordMatcher = (tokens: ChordToken[]) => boolean;

function heuristicMatcher(): ChordMatcher {
  return (tokens) => tokens.length > 0 && tokens.every((token) => isChordSymbol(token.symbol));
}

function markupMatcher(chordTokens: string[], consumed: boolean[]): ChordMatcher {
  let cursor = 0;

  return (tokens) => {
    if (tokens.length === 0) {
      return false;
    }

    const lastStart = Math.min(cursor + MARKUP_LOOKAHEAD, chordTokens.length - tokens.length);

    for (let start = cursor; start <= lastStart; start += 1) {
      if (tokens.every((token, index) => token.symbol === chordTokens[start + index])) {
        tokens.forEach((_, index) => (consumed[start + index] = true));
        cursor = start + tokens.length;
        return true;
      }
    }

    return false;
  };
}

function classifyLine(text: string, lineNumber: number, isChordLine: ChordMatcher): ClassifiedLine {
  if (!text.trim()) {
    return { lineNumber, kind: "blank", text };
  }

  const directive = text.match(DIRECTIVE);
  if (directive) {
    return {
      lineNumber,
      kind: "directive",
      text,
      directive: { name: directive[1].toLowerCase(), value: directive[2] ?? "" },
    };
  }

  const header = text.match(SECTION_HEADER);
  if (header) {
    const label = header[1].trim();
    const rest = header[2];

    if (!rest || REPEAT_MARKER.test(rest)) {
      return { lineNumber, kind: "sectionHeader", text, label };
    }

    const chords = readTokens(text, text.length - rest.length);
    if (isChordLine(chords)) {
      return { lineNumber, kind: "sectionHeaderWithChords", text, label, chords };
    }

    return { lineNumber, kind: "lyric", text };
  }

  if (TAB_LINE.test(text)) {
    return { lineNumber, kind: "tabLine", text };
  }

  if (TAB_META.test(text)) {
    return { lineNumber, kind: "tabMeta", text };
  }

  if (REPEAT_MARKER.test(text)) {
    return { lineNumber, kind: "repeatMarker", text };
  }

  const chords = readTokens(text);
  if (isChordLine(chords)) {
    return { lineNumber, kind: "chordLine", text, chords };
  }

  return { lineNumber, kind: "lyric", text };
}

export function classifyLines(lines: string[], options: ClassifyOptions = {}): ClassifyResult {
  const chordTokens = options.chordTokens ?? [];

  if (chordTokens.length > 0) {
    const consumed = chordTokens.map(() => false);
    const matcher = markupMatcher(chordTokens, consumed);
    const classified = lines.map((text, index) => classifyLine(text, index + 1, matcher));
    const coverage = consumed.filter(Boolean).length / chordTokens.length;

    if (coverage >= MIN_MARKUP_COVERAGE) {
      return {
        lines: classified,
        chordSignal: "markup",
        unmatchedChordTokens: chordTokens.filter((_, index) => !consumed[index]),
      };
    }
  }

  const matcher = heuristicMatcher();

  return {
    lines: lines.map((text, index) => classifyLine(text, index + 1, matcher)),
    chordSignal: "heuristic",
    unmatchedChordTokens: [],
  };
}
