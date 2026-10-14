import { canImport, type ImportAccessState } from "./import-access-policy";
import { importAccessDeniedResponse } from "./import-access-http";
import { isImportModuleConfigured } from "./import-module-config";
import { recordImportLog } from "./import-log";

export function chartPayloadHasOrigin(body: unknown): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const record = body as Record<string, unknown>;
  if ("chart" in record && typeof record.chart === "object" && record.chart !== null) {
    const origin = (record.chart as Record<string, unknown>).origin;
    return origin !== undefined && origin !== null;
  }

  const origin = record.origin;
  return origin !== undefined && origin !== null;
}

export function assertImportWriteAllowed(request: Request): Response | undefined {
  const state = canImport(request);
  return importAccessDeniedResponse(state);
}

export async function gateChartWriteWithOrigin(
  request: Request,
  body: unknown,
): Promise<Response | undefined> {
  if (!chartPayloadHasOrigin(body)) {
    return undefined;
  }

  const state = canImport(request);
  return importAccessDeniedResponse(state);
}

function extractOriginUrl(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const chart =
    "chart" in record && typeof record.chart === "object" && record.chart !== null
      ? (record.chart as Record<string, unknown>)
      : record;
  const origin = chart.origin;
  if (typeof origin !== "object" || origin === null) {
    return null;
  }
  const url = (origin as Record<string, unknown>).url;
  return typeof url === "string" ? url : null;
}

export async function recordSuccessfulChartSave(
  body: unknown,
  chartId: string,
): Promise<void> {
  if (!chartPayloadHasOrigin(body) || !isImportModuleConfigured()) {
    return;
  }
  await recordImportLog({
    action: "save",
    outcome: "success",
    url: extractOriginUrl(body),
    chartId,
  });
}

export async function recordFailedChartSave(body: unknown, outcome: string): Promise<void> {
  if (!chartPayloadHasOrigin(body) || !isImportModuleConfigured()) {
    return;
  }
  await recordImportLog({
    action: "save",
    outcome,
    url: extractOriginUrl(body),
  });
}

export type { ImportAccessState };
