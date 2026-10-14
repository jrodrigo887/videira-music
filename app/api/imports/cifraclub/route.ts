import { previewImport } from "@/lib/import/preview-import";
import {
  canHandleCifraClubUrl,
  ImportSourceError,
} from "@/lib/import/sources/cifraclub-parse";
import { fetchCifraClubChart } from "@/lib/import/sources/cifraclub";
import type { RawChart } from "@/types/import";
import { canImport } from "@/lib/import-access/import-access-policy";
import { importAccessDeniedResponse, importAccessError } from "@/lib/import-access/import-access-http";
import { isImportModuleConfigured } from "@/lib/import-access/import-module-config";
import { recordImportLog } from "@/lib/import-access/import-log";
import { getPreviewSlotQueue, type PreviewSlotQueue } from "@/lib/import-access/preview-slot-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HandlerDependencies = {
  canImport(request: Request): ReturnType<typeof canImport>;
  fetchChart(url: string): Promise<RawChart>;
  previewSlots: PreviewSlotQueue;
};

function errorResponse(status: number, code: string, message: string): Response {
  return importAccessError(status, code, message);
}

function sourceErrorStatus(error: ImportSourceError): number {
  return error.code === "SOURCE_TIMEOUT" ? 504 : 502;
}

function canonicalPreviewUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

export function createCifraClubPostHandler(dependencies: HandlerDependencies) {
  return async function post(request: Request): Promise<Response> {
    const access = dependencies.canImport(request);
    const denied = importAccessDeniedResponse(access);
    if (denied) {
      return denied;
    }

    const slot = dependencies.previewSlots.tryAcquire();
    if (!slot) {
      if (isImportModuleConfigured()) {
        await recordImportLog({
          action: "preview",
          outcome: "IMPORT_BUSY",
          url: null,
        });
      }
      return errorResponse(429, "IMPORT_BUSY", "Import ocupado. Tente novamente.");
    }

    let previewUrl: string | null = null;

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        const response = errorResponse(
          400,
          "INVALID_REQUEST",
          "Envie um JSON válido com o campo url.",
        );
        if (isImportModuleConfigured()) {
          await recordImportLog({ action: "preview", outcome: "INVALID_REQUEST", url: null });
        }
        return response;
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("url" in body) ||
        typeof body.url !== "string" ||
        !body.url.trim()
      ) {
        const response = errorResponse(
          400,
          "INVALID_REQUEST",
          "Envie um JSON válido com o campo url.",
        );
        if (isImportModuleConfigured()) {
          await recordImportLog({ action: "preview", outcome: "INVALID_REQUEST", url: null });
        }
        return response;
      }

      previewUrl = canonicalPreviewUrl(body.url.trim());
      if (!canHandleCifraClubUrl(previewUrl)) {
        const response = errorResponse(
          422,
          "UNSUPPORTED_SOURCE",
          "Use uma URL HTTPS do Cifra Club.",
        );
        if (isImportModuleConfigured()) {
          await recordImportLog({
            action: "preview",
            outcome: "UNSUPPORTED_SOURCE",
            url: previewUrl,
          });
        }
        return response;
      }

      try {
        const rawChart = await dependencies.fetchChart(previewUrl);
        if (isImportModuleConfigured()) {
          await recordImportLog({
            action: "preview",
            outcome: "success",
            url: previewUrl,
          });
        }
        return Response.json(
          previewImport({
            text: rawChart.text,
            origin: rawChart.origin,
            meta: rawChart.meta,
            chordTokens: rawChart.chordTokens,
          }),
        );
      } catch (error) {
        if (error instanceof ImportSourceError) {
          if (isImportModuleConfigured()) {
            await recordImportLog({
              action: "preview",
              outcome: error.code,
              url: previewUrl,
            });
          }
          return errorResponse(sourceErrorStatus(error), error.code, error.message);
        }

        if (isImportModuleConfigured()) {
          await recordImportLog({
            action: "preview",
            outcome: "SOURCE_BLOCKED",
            url: previewUrl,
          });
        }
        return errorResponse(
          502,
          "SOURCE_BLOCKED",
          "Não foi possível acessar a origem local.",
        );
      }
    } finally {
      slot.release();
    }
  };
}

export const POST = createCifraClubPostHandler({
  canImport,
  fetchChart: fetchCifraClubChart,
  previewSlots: getPreviewSlotQueue(),
});
