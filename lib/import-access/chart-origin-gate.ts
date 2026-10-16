import { canonicalizeOriginUrl } from "@/lib/persistence/origin-url";
import type { ChordChart } from "@/types/music";

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

export async function assertImportWriteAllowed(request: Request): Promise<Response | undefined> {
  const state = await canImport(request);
  return importAccessDeniedResponse(state);
}

export async function gateChartWriteWithOrigin(
  request: Request,
  body: unknown,
): Promise<Response | undefined> {
  if (!chartPayloadHasOrigin(body)) {
    return undefined;
  }

  const state = await canImport(request);
  return importAccessDeniedResponse(state);
}

export function chartOriginGateKind(
  existing: ChordChart | undefined,
  body: unknown,
): "allow" | "import" {
  const bodyHasOrigin = chartPayloadHasOrigin(body);

  if (!existing) {
    return bodyHasOrigin ? "import" : "allow";
  }

  const existingUrl = existing.origin?.url
    ? canonicalizeOriginUrl(existing.origin.url)
    : null;
  const bodyUrlRaw = extractOriginUrl(body);
  const bodyUrl = bodyUrlRaw ? canonicalizeOriginUrl(bodyUrlRaw) : null;

  if (!bodyHasOrigin) {
    return existingUrl ? "import" : "allow";
  }

  if (existingUrl && bodyUrl && existingUrl === bodyUrl) {
    return "allow";
  }

  if (!existingUrl && !bodyUrl) {
    return "allow";
  }

  return "import";
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
