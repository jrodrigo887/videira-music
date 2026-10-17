import type { ImportOriginKind } from "@/types/import";
import type { ChartFormat, ChordChart, SectionType, Song } from "@/types/music";

import { canonicalizeOriginUrl } from "./origin-url";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationFailure = {
  ok: false;
  issues: ValidationIssue[];
};

export type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

export type ParseResult<T> = ValidationSuccess<T> | ValidationFailure;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SECTION_TYPES: SectionType[] = [
  "intro",
  "verse",
  "preChorus",
  "chorus",
  "bridge",
  "instrumental",
  "solo",
  "ending",
];
const CHART_FORMATS: ChartFormat[] = ["lyrics", "grid"];
const ORIGIN_KINDS: ImportOriginKind[] = ["paste", "file", "url"];

function fail(issues: ValidationIssue[]): ValidationFailure {
  return { ok: false, issues };
}

function success<T>(value: T): ValidationSuccess<T> {
  return { ok: true, value };
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function parseId(value: unknown, path: string): string | ValidationIssue {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    return issue(path, "ID inválido.");
  }
  return value;
}

function parseVersionLabel(value: unknown): string | undefined | ValidationIssue {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return issue("versionLabel", "Versão inválida.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 80) {
    return issue("versionLabel", "A versão deve ter no máximo 80 caracteres.");
  }
  return trimmed;
}

function parseOptionalString(
  value: unknown,
  path: string,
  maxLength: number,
): string | undefined | ValidationIssue {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    return issue(path, "Texto inválido.");
  }
  return value;
}

function parseOrigin(value: unknown): ChordChart["origin"] | undefined | ValidationIssue {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    return issue("origin", "Origem inválida.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "string" || !ORIGIN_KINDS.includes(record.kind as ImportOriginKind)) {
    return issue("origin.kind", "Tipo de origem inválido.");
  }
  if (record.url !== undefined) {
    if (typeof record.url !== "string") {
      return issue("origin.url", "URL inválida.");
    }
    try {
      canonicalizeOriginUrl(record.url);
    } catch {
      return issue("origin.url", "URL inválida.");
    }
  }
  return {
    kind: record.kind as ImportOriginKind,
    ...(typeof record.url === "string" ? { url: record.url } : {}),
    ...(typeof record.sourceName === "string" ? { sourceName: record.sourceName } : {}),
    ...(typeof record.fetchedAt === "string" ? { fetchedAt: record.fetchedAt } : {}),
  };
}

function parseSections(value: unknown): ChordChart["sections"] | ValidationIssue {
  if (!Array.isArray(value)) {
    return issue("sections", "Seções inválidas.");
  }
  for (let index = 0; index < value.length; index += 1) {
    const section = value[index];
    if (typeof section !== "object" || section === null) {
      return issue(`sections[${index}]`, "Seção inválida.");
    }
    const record = section as Record<string, unknown>;
    if (typeof record.type !== "string" || !SECTION_TYPES.includes(record.type as SectionType)) {
      return issue(`sections[${index}].type`, "Tipo de seção inválido.");
    }
  }
  return value as ChordChart["sections"];
}

export function parseSongJson(body: unknown): ParseResult<Song> {
  if (typeof body !== "object" || body === null) {
    return fail([issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const id = parseId(record.id, "id");
  if (typeof id !== "string") {
    return fail([id]);
  }
  if (typeof record.title !== "string" || record.title.length === 0 || record.title.length > 200) {
    return fail([issue("title", "Título inválido.")]);
  }
  if (typeof record.label !== "string" || record.label.length === 0) {
    return fail([issue("label", "Rótulo inválido.")]);
  }
  if (!Array.isArray(record.alternateKeys) || record.alternateKeys.some((k) => typeof k !== "string")) {
    return fail([issue("alternateKeys", "Tons alternativos inválidos.")]);
  }
  if (typeof record.meta !== "string") {
    return fail([issue("meta", "Meta inválida.")]);
  }
  const artist = parseOptionalString(record.artist, "artist", 200);
  if (artist instanceof Object && "path" in artist) {
    return fail([artist]);
  }
  const genre = parseOptionalString(record.genre, "genre", 100);
  if (genre instanceof Object && "path" in genre) {
    return fail([genre]);
  }
  const defaultKey = parseOptionalString(record.defaultKey, "defaultKey", 20);
  if (defaultKey instanceof Object && "path" in defaultKey) {
    return fail([defaultKey]);
  }
  const notes = parseOptionalString(record.notes, "notes", 2000);
  if (notes instanceof Object && "path" in notes) {
    return fail([notes]);
  }

  let publicLyrics = false;
  if (record.publicLyrics !== undefined) {
    if (typeof record.publicLyrics !== "boolean") {
      return fail([issue("publicLyrics", "Valor inválido.")]);
    }
    publicLyrics = record.publicLyrics;
  }

  return success({
    id,
    title: record.title,
    label: record.label,
    alternateKeys: record.alternateKeys as string[],
    meta: record.meta,
    publicLyrics,
    ...(typeof artist === "string" ? { artist } : {}),
    ...(typeof genre === "string" ? { genre } : {}),
    ...(typeof defaultKey === "string" ? { defaultKey } : {}),
    ...(typeof notes === "string" ? { notes } : {}),
  });
}

export function parseChartJson(body: unknown): ParseResult<ChordChart> {
  if (typeof body !== "object" || body === null) {
    return fail([issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const id = parseId(record.id, "id");
  if (typeof id !== "string") {
    return fail([id]);
  }
  const songId = parseId(record.songId, "songId");
  if (typeof songId !== "string") {
    return fail([songId]);
  }
  if (typeof record.format !== "string" || !CHART_FORMATS.includes(record.format as ChartFormat)) {
    return fail([issue("format", "Formato inválido.")]);
  }
  if (typeof record.key !== "string" || record.key.length === 0) {
    return fail([issue("key", "Tom inválido.")]);
  }
  if (typeof record.timeSignature !== "string" || record.timeSignature.length === 0) {
    return fail([issue("timeSignature", "Compasso inválido.")]);
  }
  if (record.tempo !== undefined) {
    if (typeof record.tempo !== "number" || record.tempo < 1 || record.tempo > 400) {
      return fail([issue("tempo", "Andamento inválido.")]);
    }
  }
  if (record.capo !== undefined) {
    if (typeof record.capo !== "number" || record.capo < 0 || record.capo > 24) {
      return fail([issue("capo", "Capotraste inválido.")]);
    }
  }
  const sections = parseSections(record.sections);
  if ("path" in sections) {
    return fail([sections]);
  }
  const origin = parseOrigin(record.origin);
  if (origin && "path" in origin) {
    return fail([origin]);
  }
  const title = parseOptionalString(record.title, "title", 200);
  if (title instanceof Object && "path" in title) {
    return fail([title]);
  }
  const versionLabel = parseVersionLabel(record.versionLabel);
  if (versionLabel instanceof Object && "path" in versionLabel) {
    return fail([versionLabel]);
  }
  const source = parseOptionalString(record.source, "source", 500_000);
  if (source instanceof Object && "path" in source) {
    return fail([source]);
  }

  return success({
    id,
    songId,
    format: record.format as ChartFormat,
    key: record.key,
    timeSignature: record.timeSignature,
    sections,
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof versionLabel === "string" ? { versionLabel } : {}),
    ...(typeof record.tempo === "number" ? { tempo: record.tempo } : {}),
    ...(typeof record.capo === "number" ? { capo: record.capo } : {}),
    ...(typeof source === "string" ? { source } : {}),
    ...(origin ? { origin } : {}),
  });
}

export function parseSongChartBody(body: unknown): ParseResult<{ song?: Song; chart: ChordChart }> {
  if (typeof body !== "object" || body === null) {
    return fail([issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  let song: Song | undefined;
  if (record.song !== undefined) {
    const parsedSong = parseSongJson(record.song);
    if (!parsedSong.ok) {
      return parsedSong;
    }
    song = parsedSong.value;
  }
  const parsedChart = parseChartJson(record.chart);
  if (!parsedChart.ok) {
    return parsedChart;
  }
  if (song && song.id !== parsedChart.value.songId) {
    return fail([issue("songId", "songId da cifra deve coincidir com a música.")]);
  }
  return success({ song, chart: parsedChart.value });
}

export function parseMigrationBatch(body: unknown): ParseResult<{ songs: Song[]; charts: ChordChart[] }> {
  if (typeof body !== "object" || body === null) {
    return fail([issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.songs) || !Array.isArray(record.charts)) {
    return fail([issue("body", "Lote inválido.")]);
  }
  const songs: Song[] = [];
  for (let index = 0; index < record.songs.length; index += 1) {
    const parsed = parseSongJson(record.songs[index]);
    if (!parsed.ok) {
      return fail(parsed.issues.map((item) => ({ ...item, path: `songs[${index}].${item.path}` })));
    }
    songs.push(parsed.value);
  }
  const charts: ChordChart[] = [];
  for (let index = 0; index < record.charts.length; index += 1) {
    const parsed = parseChartJson(record.charts[index]);
    if (!parsed.ok) {
      return fail(parsed.issues.map((item) => ({ ...item, path: `charts[${index}].${item.path}` })));
    }
    charts.push(parsed.value);
  }
  return success({ songs, charts });
}

export const WRITE_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
export const MIGRATION_BODY_LIMIT_BYTES = 8 * 1024 * 1024;
