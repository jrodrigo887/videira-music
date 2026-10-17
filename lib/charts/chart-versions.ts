export const PRINCIPAL_VERSION_LABEL = "Principal";

export const CHART_VERSION_PRESETS = [PRINCIPAL_VERSION_LABEL, "Simplificada", "Letra"] as const;

export const CHART_VERSION_MAX_LENGTH = 80;

const PRESET_RANK = new Map(
  CHART_VERSION_PRESETS.map((label, index) => [label.toLowerCase(), index]),
);

export function chartVersionLabel(chart: { versionLabel?: string | null }): string {
  const label = chart.versionLabel?.trim();
  return label || PRINCIPAL_VERSION_LABEL;
}

export function isPrincipalVersion(label: string | null | undefined): boolean {
  const trimmed = label?.trim().toLowerCase();
  return !trimmed || trimmed === PRINCIPAL_VERSION_LABEL.toLowerCase();
}

export function originalChart<T extends { versionLabel?: string | null }>(charts: T[]): T | undefined {
  return charts.find((chart) => isPrincipalVersion(chart.versionLabel)) ?? charts[0];
}

export function songVersionTags<T extends { id: string; versionLabel?: string | null }>(
  charts: T[],
): { chartId: string; label: string }[] {
  const original = originalChart(charts);
  return sortChartsByVersion(
    charts.map((chart) => ({
      ...chart,
      versionLabel: chart === original ? PRINCIPAL_VERSION_LABEL : chartVersionLabel(chart),
    })),
  ).map((chart) => ({
    chartId: chart.id,
    label: chart.versionLabel?.trim() || PRINCIPAL_VERSION_LABEL,
  }));
}

export function isLyricsOnlyVersion(label: string | null | undefined): boolean {
  return label?.trim().toLowerCase() === "letra";
}

export function sortChartsByVersion<T extends { versionLabel?: string | null }>(charts: T[]): T[] {
  return charts
    .map((chart, index) => ({ chart, index }))
    .sort((left, right) => {
      const leftRank =
        PRESET_RANK.get(chartVersionLabel(left.chart).toLowerCase()) ?? PRESET_RANK.size;
      const rightRank =
        PRESET_RANK.get(chartVersionLabel(right.chart).toLowerCase()) ?? PRESET_RANK.size;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.index - right.index;
    })
    .map((item) => item.chart);
}
