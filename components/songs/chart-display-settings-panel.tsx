"use client";

import { useId, useState } from "react";

import {
  CHART_DISPLAY_LIMITS,
  CHART_FONT_FAMILIES,
  DEFAULT_CHART_DISPLAY,
  isDefaultChartDisplay,
  stepChartSetting,
  type ChartDisplaySettings,
  type ChartFontFamily,
} from "@/lib/songs/chart-display-preference";

type ChartDisplaySettingsPanelProps = {
  value: ChartDisplaySettings;
  onChange: (next: ChartDisplaySettings) => void;
};

type StepperSetting = "fontSize" | "lineHeight" | "lineGap" | "letterSpacing";

const STEPPERS: Array<{
  setting: StepperSetting;
  label: string;
  name: string;
  format: (value: number) => string;
}> = [
  { setting: "fontSize", label: "Tamanho", name: "tamanho", format: (value) => `${value}px` },
  {
    setting: "lineHeight",
    label: "Altura da linha",
    name: "altura da linha",
    format: (value) => value.toFixed(1),
  },
  {
    setting: "lineGap",
    label: "Espaçamento",
    name: "espaço entre linhas",
    format: (value) => `${value}px`,
  },
  {
    setting: "letterSpacing",
    label: "Entre letras",
    name: "espaço entre letras",
    format: (value) => `${value}px`,
  },
];

const COLOR_SETTINGS: Array<{
  setting: "lyricsColor" | "chordColor";
  label: string;
  fallback: string;
}> = [
  { setting: "lyricsColor", label: "Cor da letra", fallback: "#17171c" },
  { setting: "chordColor", label: "Cor da cifra", fallback: "#307744" },
];

const stepButtonClassName =
  "inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-content-muted transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";

export function ChartDisplaySettingsPanel({ value, onChange }: ChartDisplaySettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-content transition hover:bg-surface-muted/60"
      >
        <span className="font-semibold">Texto</span>
        <span className="text-content-subtle">
          {value.fontSize}px{" "}
          <span aria-hidden="true" className={`inline-block transition ${open ? "rotate-90" : ""}`}>
            ›
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="space-y-3 px-4 pb-4 pt-1 text-xs">
          <div role="group" aria-label="Estilo da fonte" className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1">
            {(Object.keys(CHART_FONT_FAMILIES) as ChartFontFamily[]).map((family) => (
              <button
                key={family}
                type="button"
                aria-pressed={value.fontFamily === family}
                onClick={() => onChange({ ...value, fontFamily: family })}
                style={{ fontFamily: CHART_FONT_FAMILIES[family].stack }}
                className={`rounded-full px-2 py-1 font-semibold transition ${
                  value.fontFamily === family
                    ? "bg-surface text-content shadow-xs"
                    : "text-content-subtle hover:text-content"
                }`}
              >
                {CHART_FONT_FAMILIES[family].label}
              </button>
            ))}
          </div>

          {STEPPERS.map(({ setting, label, name, format }) => {
            const { min, max } = CHART_DISPLAY_LIMITS[setting];
            return (
              <div key={setting} className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap font-semibold text-content">{label}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Diminuir ${name}`}
                    disabled={value[setting] <= min}
                    onClick={() => onChange(stepChartSetting(value, setting, -1))}
                    className={stepButtonClassName}
                  >
                    −
                  </button>
                  <span className="min-w-10 text-center font-bold text-primary">
                    {format(value[setting])}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar ${name}`}
                    disabled={value[setting] >= max}
                    onClick={() => onChange(stepChartSetting(value, setting, 1))}
                    className={stepButtonClassName}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          {COLOR_SETTINGS.map(({ setting, label, fallback }) => {
            const custom = value[setting];
            return (
              <div key={setting} className="flex items-center justify-between gap-2">
                <span className="font-semibold text-content">{label}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={!custom}
                    onClick={() => onChange({ ...value, [setting]: undefined })}
                    className={`rounded-full border px-2 py-0.5 font-semibold transition ${
                      custom
                        ? "border-border text-content-subtle hover:border-primary hover:text-primary"
                        : "border-primary bg-primary-subtle text-primary"
                    }`}
                  >
                    Padrão
                  </button>
                  <input
                    type="color"
                    aria-label={label}
                    value={custom ?? fallback}
                    onChange={(event) => onChange({ ...value, [setting]: event.target.value })}
                    className="h-6 w-6 cursor-pointer appearance-none overflow-hidden rounded-full border border-border bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
                  />
                </div>
              </div>
            );
          })}

          {!isDefaultChartDisplay(value) ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_CHART_DISPLAY)}
              className="w-full rounded-full border border-border py-1.5 font-semibold text-primary transition hover:border-primary hover:bg-primary-subtle/50"
            >
              Restaurar padrão
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
