export type BrandTheme = {
  name: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  primarySubtle: string;
  chord: string;
};

export type BrandStyle = {
  "--brand-primary": string;
  "--brand-primary-hover": string;
  "--brand-primary-foreground": string;
  "--brand-primary-subtle": string;
  "--brand-chord": string;
};

const COLOR_KEYS = [
  "primary",
  "primaryHover",
  "primaryForeground",
  "primarySubtle",
  "chord",
] as const;

const HSL_CHANNEL_PATTERN = /^\d{1,3}(?:\.\d+)? \d{1,3}% \d{1,3}%$/;

const KEY_TO_CSS: Record<(typeof COLOR_KEYS)[number], keyof BrandStyle> = {
  primary: "--brand-primary",
  primaryHover: "--brand-primary-hover",
  primaryForeground: "--brand-primary-foreground",
  primarySubtle: "--brand-primary-subtle",
  chord: "--brand-chord",
};

export const videiraBrand: BrandTheme = {
  name: "Videira",
  primary: "136 42% 33%",
  primaryHover: "140 45% 22%",
  primaryForeground: "0 0% 100%",
  primarySubtle: "138 38% 96%",
  chord: "136 42% 33%",
};

export function brandStyle(brand: object): BrandStyle {
  const record = brand as Record<string, unknown>;
  const result = {} as BrandStyle;

  for (const key of COLOR_KEYS) {
    const value = record[key];
    if (value === undefined) {
      throw new Error(`Brand color ${key} is required.`);
    }
    if (typeof value !== "string" || !HSL_CHANNEL_PATTERN.test(value)) {
      throw new Error(
        `Brand color ${key} must be HSL channels, for example "136 42% 33%".`,
      );
    }
    result[KEY_TO_CSS[key]] = value;
  }

  return result;
}
