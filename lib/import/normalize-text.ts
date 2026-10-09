const DEFAULT_TAB_SIZE = 4;
const SPACE_LIKE = /[\u00A0\u2007\u202F\u2000-\u200A\u3000]/g;
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;

type NormalizeOptions = {
  tabSize?: number;
};

function expandTabs(line: string, tabSize: number): string {
  let result = "";

  for (const char of line) {
    if (char === "\t") {
      result += " ".repeat(tabSize - (result.length % tabSize));
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Devolve uma linha por linha do texto original (o indice + 1 e a linha 1-based da fonte).
 * Preserva a indentacao, que carrega o alinhamento dos acordes sobre a letra.
 */
export function normalizeText(text: string, options: NormalizeOptions = {}): string[] {
  const tabSize = options.tabSize ?? DEFAULT_TAB_SIZE;

  return text
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, "")
    .replace(SPACE_LIKE, " ")
    .split("\n")
    .map((line) => expandTabs(line, tabSize).trimEnd());
}
