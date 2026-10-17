export const MAX_CHART_SOURCE_BYTES = 500 * 1024;

export const EMPTY_CHART_SOURCE_MESSAGE = "Informe o texto da cifra.";

export const CHART_SOURCE_TOO_LARGE_MESSAGE = "O texto deve ter no máximo 500 KiB.";

export function validateChartSourceText(source: string): { ok: true } | { ok: false; message: string } {
  if (!source.trim()) {
    return { ok: false, message: EMPTY_CHART_SOURCE_MESSAGE };
  }
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength > MAX_CHART_SOURCE_BYTES) {
    return { ok: false, message: CHART_SOURCE_TOO_LARGE_MESSAGE };
  }
  return { ok: true };
}
