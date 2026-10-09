import type { SectionType } from "@/types/music";

const ORDINAL = "(?:primeira|segunda|terceira|quarta|quinta|sexta|\\d+[ao]?)";

/** Casam com o inicio do rotulo normalizado; a ordem importa (`pre refrao` antes de `refrao`). */
const SECTION_PATTERNS: [RegExp, SectionType][] = [
  [/^(?:intro|introducao)\b/, "intro"],
  [/^pre ?refrao\b/, "preChorus"],
  [/^(?:refrao|coro)\b/, "chorus"],
  [new RegExp(`^(?:${ORDINAL} parte|parte|verso|estrofe)\\b`), "verse"],
  [/^ponte\b/, "bridge"],
  [/^solo\b/, "solo"],
  [/^(?:instrumental|interludio|passagem)\b/, "instrumental"],
  [/^(?:final|outro|finalizacao)\b/, "ending"],
];

/** `"1ª Pré-Refrão (2x)"` -> `"1a pre refrao 2x"`. */
function normalizeLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `undefined` quando o rotulo nao e reconhecido (a fatia 5 gera `UNKNOWN_SECTION`). */
export function matchSectionType(label: string): SectionType | undefined {
  const normalized = normalizeLabel(label);
  return SECTION_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1];
}

export function resolveSectionType(label: string): SectionType {
  return matchSectionType(label) ?? "verse";
}
