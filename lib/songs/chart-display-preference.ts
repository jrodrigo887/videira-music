import type { CSSProperties } from "react";

const STORAGE_KEY = "videira-music:chart-display";

export type ChartDisplayStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ChartFontFamily = "mono" | "sans" | "serif";

export type ChartDisplaySettings = {
  fontFamily: ChartFontFamily;
  /** px */
  fontSize: number;
  /** Multiplicador sobre o tamanho da fonte. */
  lineHeight: number;
  /** px entre cada par cifra/letra. */
  lineGap: number;
  /** px */
  letterSpacing: number;
  /** Hex; ausente usa a cor do tema. */
  lyricsColor?: string;
  /** Hex; ausente usa a cor do tema. */
  chordColor?: string;
};

type NumericSetting = "fontSize" | "lineHeight" | "lineGap" | "letterSpacing";

type SettingLimit = { min: number; max: number; step: number };

export const CHART_DISPLAY_LIMITS: Record<NumericSetting, SettingLimit> = {
  fontSize: { min: 10, max: 28, step: 1 },
  lineHeight: { min: 1, max: 2.4, step: 0.1 },
  lineGap: { min: 0, max: 32, step: 2 },
  letterSpacing: { min: -1, max: 3, step: 0.5 },
};

export const DEFAULT_CHART_DISPLAY: ChartDisplaySettings = {
  fontFamily: "mono",
  fontSize: 14,
  lineHeight: 1.6,
  lineGap: 0,
  letterSpacing: 0,
};

export const CHART_FONT_FAMILIES: Record<ChartFontFamily, { label: string; stack: string }> = {
  mono: {
    label: "Mono",
    stack: "var(--font-chord), ui-monospace, SFMono-Regular, monospace",
  },
  sans: {
    label: "Legível",
    stack: "var(--font-lyrics), system-ui, sans-serif",
  },
  serif: {
    label: "Serifa",
    stack: "Georgia, 'Times New Roman', serif",
  },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function roundToStep(value: number, step: number): number {
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

export function clampChartSetting(setting: NumericSetting, value: number): number {
  const { min, max, step } = CHART_DISPLAY_LIMITS[setting];
  return roundToStep(Math.min(max, Math.max(min, value)), step);
}

export function stepChartSetting(
  settings: ChartDisplaySettings,
  setting: NumericSetting,
  direction: 1 | -1,
): ChartDisplaySettings {
  const { step } = CHART_DISPLAY_LIMITS[setting];
  return { ...settings, [setting]: clampChartSetting(setting, settings[setting] + direction * step) };
}

function isFontFamily(value: unknown): value is ChartFontFamily {
  return typeof value === "string" && value in CHART_FONT_FAMILIES;
}

function readNumber(source: Record<string, unknown>, setting: NumericSetting): number {
  const value = source[setting];
  return typeof value === "number" && Number.isFinite(value)
    ? clampChartSetting(setting, value)
    : DEFAULT_CHART_DISPLAY[setting];
}

function readColor(value: unknown): string | undefined {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : undefined;
}

export function normalizeChartDisplay(value: unknown): ChartDisplaySettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_CHART_DISPLAY;
  }

  const source = value as Record<string, unknown>;
  const settings: ChartDisplaySettings = {
    fontFamily: isFontFamily(source.fontFamily) ? source.fontFamily : DEFAULT_CHART_DISPLAY.fontFamily,
    fontSize: readNumber(source, "fontSize"),
    lineHeight: readNumber(source, "lineHeight"),
    lineGap: readNumber(source, "lineGap"),
    letterSpacing: readNumber(source, "letterSpacing"),
  };

  const lyricsColor = readColor(source.lyricsColor);
  const chordColor = readColor(source.chordColor);
  if (lyricsColor) settings.lyricsColor = lyricsColor;
  if (chordColor) settings.chordColor = chordColor;

  return settings;
}

export function isDefaultChartDisplay(settings: ChartDisplaySettings): boolean {
  return (
    settings.fontFamily === DEFAULT_CHART_DISPLAY.fontFamily &&
    settings.fontSize === DEFAULT_CHART_DISPLAY.fontSize &&
    settings.lineHeight === DEFAULT_CHART_DISPLAY.lineHeight &&
    settings.lineGap === DEFAULT_CHART_DISPLAY.lineGap &&
    settings.letterSpacing === DEFAULT_CHART_DISPLAY.letterSpacing &&
    !settings.lyricsColor &&
    !settings.chordColor
  );
}

function storageOrDefault(storage?: ChartDisplayStorage): ChartDisplayStorage | undefined {
  if (storage) {
    return storage;
  }

  if (typeof globalThis.localStorage === "undefined") {
    return undefined;
  }

  return globalThis.localStorage;
}

export function readChartDisplay(storage?: ChartDisplayStorage): ChartDisplaySettings {
  const resolved = storageOrDefault(storage);
  if (!resolved) {
    return DEFAULT_CHART_DISPLAY;
  }

  try {
    const raw = resolved.getItem(STORAGE_KEY);
    return raw ? normalizeChartDisplay(JSON.parse(raw)) : DEFAULT_CHART_DISPLAY;
  } catch {
    return DEFAULT_CHART_DISPLAY;
  }
}

export function writeChartDisplay(
  settings: ChartDisplaySettings,
  storage?: ChartDisplayStorage,
): void {
  const resolved = storageOrDefault(storage);
  if (!resolved) {
    return;
  }

  const normalized = normalizeChartDisplay(settings);
  if (isDefaultChartDisplay(normalized)) {
    resolved.removeItem(STORAGE_KEY);
    return;
  }

  resolved.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function chartDisplayStyle(settings: ChartDisplaySettings): CSSProperties {
  const style: Record<string, string> = {
    "--chart-font-family": CHART_FONT_FAMILIES[settings.fontFamily].stack,
    "--chart-font-size": `${settings.fontSize}px`,
    "--chart-line-height": String(settings.lineHeight),
    "--chart-line-gap": `${settings.lineGap}px`,
    "--chart-letter-spacing": `${settings.letterSpacing}px`,
  };

  if (settings.lyricsColor) style["--chart-lyrics-color"] = settings.lyricsColor;
  if (settings.chordColor) style["--chart-chord-color"] = settings.chordColor;

  return style as CSSProperties;
}
