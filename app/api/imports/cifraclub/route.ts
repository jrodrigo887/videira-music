import { previewImport } from "@/lib/import/preview-import";
import {
  canHandleCifraClubUrl,
  ImportSourceError,
} from "@/lib/import/sources/cifraclub-parse";
import { fetchCifraClubChart } from "@/lib/import/sources/cifraclub";
import type { RawChart } from "@/types/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HandlerDependencies = {
  enabled(): boolean;
  fetchChart(url: string): Promise<RawChart>;
};

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function sourceErrorStatus(error: ImportSourceError): number {
  return error.code === "SOURCE_TIMEOUT" ? 504 : 502;
}

export function createCifraClubPostHandler(dependencies: HandlerDependencies) {
  return async function post(request: Request): Promise<Response> {
    if (!dependencies.enabled()) {
      return errorResponse(404, "NOT_FOUND", "Recurso não encontrado.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "Envie um JSON válido com o campo url.",
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("url" in body) ||
      typeof body.url !== "string" ||
      !body.url.trim()
    ) {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "Envie um JSON válido com o campo url.",
      );
    }

    const url = body.url.trim();
    if (!canHandleCifraClubUrl(url)) {
      return errorResponse(
        422,
        "UNSUPPORTED_SOURCE",
        "Use uma URL HTTPS do Cifra Club.",
      );
    }

    try {
      const rawChart = await dependencies.fetchChart(url);
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
        return errorResponse(sourceErrorStatus(error), error.code, error.message);
      }

      return errorResponse(
        502,
        "SOURCE_BLOCKED",
        "Não foi possível acessar a origem local.",
      );
    }
  };
}

export const POST = createCifraClubPostHandler({
  enabled: () => process.env.VIDEIRA_ENABLE_CIFRACLUB_IMPORT === "true",
  fetchChart: fetchCifraClubChart,
});
