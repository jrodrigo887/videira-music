import { load } from "cheerio";

import { parseCapo, parseKey } from "@/lib/import/detect-key";
import type { ImportErrorCode, RawChart, RawChartMeta } from "@/types/import";

const SUPPORTED_HOSTS = new Set(["cifraclub.com.br", "www.cifraclub.com.br"]);

type JsonObject = Record<string, unknown>;

export class ImportSourceError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ImportSourceError";
  }
}

export function canHandleCifraClubUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SUPPORTED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasType(value: JsonObject, type: string): boolean {
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return types.includes(type);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readJsonLd(html: string): JsonObject[] {
  const $ = load(html);

  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((element) => {
      try {
        const parsed: unknown = JSON.parse($(element).text());
        const values = Array.isArray(parsed) ? parsed : [parsed];
        return values.filter(isObject);
      } catch {
        return [];
      }
    });
}

function personNames(value: unknown): string[] {
  const people = Array.isArray(value) ? value : [value];
  return people.flatMap((person) => {
    const name = isObject(person) ? optionalString(person.name) : undefined;
    return name ? [name] : [];
  });
}

function breadcrumbGenre(records: JsonObject[]): string | undefined {
  const breadcrumb = records.find((record) => hasType(record, "BreadcrumbList"));
  const items = Array.isArray(breadcrumb?.itemListElement)
    ? breadcrumb.itemListElement
    : [];
  const genre = items.find((item) => isObject(item) && item.position === 2);
  return isObject(genre) ? optionalString(genre.name) : undefined;
}

function youtubeUrl(html: string): string | undefined {
  const id = html.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/|ytimg\.com\/vi\/)([A-Za-z0-9_-]{11})/,
  )?.[1];
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}

function readMetadata(html: string): RawChartMeta {
  const $ = load(html);
  const records = readJsonLd(html);
  const composition = records.find((record) => hasType(record, "MusicComposition"));
  const recording = records.find((record) => hasType(record, "MusicRecording"));
  const config = $("[data-chord-config]").first().text();
  const keyLabel = optionalString(config.match(/Tom:\s*([^\n]+)/i)?.[1]);
  const capoLabel = optionalString(config.match(/Capotraste:\s*([^\n]+)/i)?.[1]);
  const title = optionalString(composition?.name) ?? optionalString($("h1").first().text());
  const artist =
    (isObject(recording?.byArtist) ? optionalString(recording.byArtist.name) : undefined) ??
    optionalString($("h1 + a h2").first().text());
  const composers = personNames(composition?.composer);
  const genre = breadcrumbGenre(records);
  const video = youtubeUrl(html);

  return {
    ...(title ? { title } : {}),
    ...(artist ? { artist } : {}),
    ...(composers.length ? { composers } : {}),
    ...(genre ? { genre } : {}),
    ...(keyLabel ? { key: parseKey(keyLabel), keyLabel } : {}),
    ...(capoLabel ? { capo: parseCapo(capoLabel), capoLabel } : {}),
    ...(video ? { youtubeUrl: video } : {}),
  };
}

export function extractCifraClubRawChart(
  html: string,
  url: string,
  fetchedAt: string,
): RawChart {
  if (!canHandleCifraClubUrl(url)) {
    throw new ImportSourceError("UNSUPPORTED_SOURCE", "A URL informada não é do Cifra Club.");
  }

  const $ = load(html);
  const chart = $("pre[data-chord-content]").first();
  const text = chart.text().replace(/\r\n?/g, "\n");

  if (!chart.length || !text.trim()) {
    throw new ImportSourceError(
      "SOURCE_LAYOUT_CHANGED",
      "A página não contém a cifra no formato esperado.",
    );
  }

  const chordTokens = chart
    .find("[data-chord-name]")
    .toArray()
    .flatMap((element) => {
      const chord = $(element).attr("data-chord-name");
      return chord ? [chord] : [];
    });

  return {
    text,
    chordTokens,
    meta: readMetadata(html),
    origin: {
      kind: "url",
      url,
      sourceName: "Cifra Club",
      fetchedAt,
    },
  };
}
