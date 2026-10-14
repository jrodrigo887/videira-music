import { isTransposableKey } from "@/lib/chords/transpose-chord";
import type { ValidationIssue } from "@/lib/persistence/validate-persistence-input";
import type {
  CloneSetlistInput,
  CreateSetlistInput,
  DeleteSetlistInput,
  FollowSetlistInput,
  ReplaceSetlistItemInput,
  ReplaceSetlistItemsInput,
  SetlistEventType,
  SetlistStatus,
  SetlistVisibility,
  UpdateSetlistInput,
} from "@/types/setlist";

export type SetlistValidationCode =
  | "INVALID_REQUEST"
  | "INVALID_ITEM"
  | "INVALID_KEY";

export type SetlistParseFailure = {
  ok: false;
  code: SetlistValidationCode;
  issues: ValidationIssue[];
};

export type SetlistParseSuccess<T> = {
  ok: true;
  value: T;
};

export type SetlistParseResult<T> = SetlistParseSuccess<T> | SetlistParseFailure;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EVENT_TYPES: SetlistEventType[] = ["service", "rehearsal", "event"];
const VISIBILITIES: SetlistVisibility[] = ["private", "team", "organization", "public"];
const STATUSES: SetlistStatus[] = ["draft", "published", "archived"];

const TITLE_MIN = 1;
const TITLE_MAX = 120;
const SETLIST_NOTES_MAX = 2000;
const NOTE_TEXT_MIN = 1;
const NOTE_TEXT_MAX = 500;
const ITEM_NOTES_MAX = 500;
const MAX_ITEMS = 100;

function fail(code: SetlistValidationCode, issues: ValidationIssue[]): SetlistParseFailure {
  return { ok: false, code, issues };
}

function success<T>(value: T): SetlistParseSuccess<T> {
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

function parseTrimmedString(
  value: unknown,
  path: string,
  min: number,
  max: number,
): string | ValidationIssue {
  if (typeof value !== "string") {
    return issue(path, "Texto inválido.");
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return issue(path, "Texto inválido.");
  }
  return trimmed;
}

function parseOptionalTrimmedString(
  value: unknown,
  path: string,
  max: number,
): string | undefined | ValidationIssue {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return issue(path, "Texto inválido.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    return issue(path, "Texto inválido.");
  }
  return trimmed;
}

function parseExpectedVersion(value: unknown): number | ValidationIssue {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return issue("expectedVersion", "Versão inválida.");
  }
  return value;
}

function parseEventType(value: unknown): SetlistEventType | undefined | ValidationIssue {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !EVENT_TYPES.includes(value as SetlistEventType)) {
    return issue("eventType", "Tipo de evento inválido.");
  }
  return value as SetlistEventType;
}

function parseVisibility(value: unknown): SetlistVisibility | undefined | ValidationIssue {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !VISIBILITIES.includes(value as SetlistVisibility)) {
    return issue("visibility", "Visibilidade inválida.");
  }
  return value as SetlistVisibility;
}

function parseIsoDate(value: unknown, path: string): string | undefined | ValidationIssue {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return issue(path, "Data inválida.");
  }
  return value;
}

function parseReplaceItem(value: unknown, index: number): ReplaceSetlistItemInput | ValidationIssue {
  if (typeof value !== "object" || value === null) {
    return issue(`items[${index}]`, "Item inválido.");
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== "song" && kind !== "note") {
    return issue(`items[${index}].kind`, "Tipo de item inválido.");
  }

  let id: string | undefined;
  if (record.id !== undefined) {
    const parsedId = parseId(record.id, `items[${index}].id`);
    if (typeof parsedId !== "string") {
      return parsedId;
    }
    id = parsedId;
  }

  const notes = parseOptionalTrimmedString(record.notes, `items[${index}].notes`, ITEM_NOTES_MAX);
  if (notes instanceof Object && "path" in notes) {
    return notes;
  }

  if (kind === "note") {
    const text = parseTrimmedString(record.text, `items[${index}].text`, NOTE_TEXT_MIN, NOTE_TEXT_MAX);
    if (typeof text !== "string") {
      return text;
    }
    return { ...(id ? { id } : {}), kind: "note", text, ...(notes ? { notes } : {}) };
  }

  const songId = parseId(record.songId, `items[${index}].songId`);
  if (typeof songId !== "string") {
    return songId;
  }
  const chartId = parseId(record.chartId, `items[${index}].chartId`);
  if (typeof chartId !== "string") {
    return chartId;
  }

  if (record.selectedKey !== undefined) {
    if (typeof record.selectedKey !== "string" || !isTransposableKey(record.selectedKey)) {
      return issue(`items[${index}].selectedKey`, "Tom inválido.");
    }
  }

  return {
    ...(id ? { id } : {}),
    kind: "song",
    songId,
    chartId,
    ...(typeof record.selectedKey === "string" ? { selectedKey: record.selectedKey } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function parseCreateSetlist(body: unknown): SetlistParseResult<CreateSetlistInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const title = parseTrimmedString(record.title, "title", TITLE_MIN, TITLE_MAX);
  if (typeof title !== "string") {
    issues.push(title);
  }

  let ownerTeamId: string | undefined;
  if (record.ownerTeamId !== undefined) {
    const parsed = parseId(record.ownerTeamId, "ownerTeamId");
    if (typeof parsed === "string") {
      ownerTeamId = parsed;
    } else {
      issues.push(parsed);
    }
  }

  let owner: "organization" | undefined;
  if (record.owner !== undefined) {
    if (record.owner !== "organization") {
      issues.push(issue("owner", "Dono inválido."));
    } else {
      owner = "organization";
    }
  }

  const eventType = parseEventType(record.eventType);
  if (eventType instanceof Object && "path" in eventType) {
    issues.push(eventType);
  }

  const visibility = parseVisibility(record.visibility);
  if (visibility instanceof Object && "path" in visibility) {
    issues.push(visibility);
  }

  const eventAt = parseIsoDate(record.eventAt, "eventAt");
  if (eventAt instanceof Object && "path" in eventAt) {
    issues.push(eventAt);
  }

  const notes = parseOptionalTrimmedString(record.notes, "notes", SETLIST_NOTES_MAX);
  if (notes instanceof Object && "path" in notes) {
    issues.push(notes);
  }

  if (issues.length > 0) {
    return fail("INVALID_REQUEST", issues);
  }

  const value: CreateSetlistInput = { title: title as string };
  if (ownerTeamId) {
    value.ownerTeamId = ownerTeamId;
  }
  if (owner) {
    value.owner = owner;
  }
  if (typeof eventType === "string") {
    value.eventType = eventType;
  }
  if (typeof visibility === "string") {
    value.visibility = visibility;
  }
  if (typeof eventAt === "string") {
    value.eventAt = eventAt;
  }
  if (typeof notes === "string") {
    value.notes = notes;
  }

  return success(value);
}

export function parseUpdateSetlist(body: unknown): SetlistParseResult<UpdateSetlistInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const expectedVersion = parseExpectedVersion(record.expectedVersion);
  if (typeof expectedVersion !== "number") {
    issues.push(expectedVersion);
  }

  if (record.title !== undefined) {
    const title = parseTrimmedString(record.title, "title", TITLE_MIN, TITLE_MAX);
    if (typeof title !== "string") {
      issues.push(title);
    }
  }

  if (record.eventType !== undefined) {
    if (record.eventType === null) {
      // allowed clear
    } else {
      const eventType = parseEventType(record.eventType);
      if (eventType instanceof Object && "path" in eventType) {
        issues.push(eventType);
      }
    }
  }

  if (record.visibility !== undefined) {
    const visibility = parseVisibility(record.visibility);
    if (visibility instanceof Object && "path" in visibility) {
      issues.push(visibility);
    }
  }

  if (record.status !== undefined) {
    if (typeof record.status !== "string" || !STATUSES.includes(record.status as SetlistStatus)) {
      issues.push(issue("status", "Status inválido."));
    }
  }

  if (record.eventAt !== undefined && record.eventAt !== null) {
    const eventAt = parseIsoDate(record.eventAt, "eventAt");
    if (eventAt instanceof Object && "path" in eventAt) {
      issues.push(eventAt);
    }
  }

  if (record.notes !== undefined && record.notes !== null) {
    const notes = parseOptionalTrimmedString(record.notes, "notes", SETLIST_NOTES_MAX);
    if (notes instanceof Object && "path" in notes) {
      issues.push(notes);
    }
  }

  if (record.confirmFollowersImpact !== undefined && typeof record.confirmFollowersImpact !== "boolean") {
    issues.push(issue("confirmFollowersImpact", "Confirmação inválida."));
  }

  if (issues.length > 0) {
    return fail("INVALID_REQUEST", issues);
  }

  const value: UpdateSetlistInput = {
    expectedVersion: expectedVersion as number,
  };
  if (typeof record.title === "string") {
    value.title = parseTrimmedString(record.title, "title", TITLE_MIN, TITLE_MAX) as string;
  }
  if (record.eventType !== undefined) {
    value.eventType =
      record.eventType === null
        ? null
        : (parseEventType(record.eventType) as SetlistEventType);
  }
  if (record.eventAt !== undefined) {
    value.eventAt =
      record.eventAt === null ? null : (parseIsoDate(record.eventAt, "eventAt") as string);
  }
  if (record.notes !== undefined) {
    value.notes =
      record.notes === null
        ? null
        : (parseOptionalTrimmedString(record.notes, "notes", SETLIST_NOTES_MAX) as string);
  }
  if (record.visibility !== undefined) {
    value.visibility = parseVisibility(record.visibility) as SetlistVisibility;
  }
  if (record.status !== undefined) {
    value.status = record.status as SetlistStatus;
  }
  if (record.confirmFollowersImpact === true) {
    value.confirmFollowersImpact = true;
  }

  return success(value);
}

export function parseReplaceItems(body: unknown): SetlistParseResult<ReplaceSetlistItemsInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const expectedVersion = parseExpectedVersion(record.expectedVersion);
  if (typeof expectedVersion !== "number") {
    issues.push(expectedVersion);
  }

  if (!Array.isArray(record.items)) {
    return fail("INVALID_ITEM", [issue("items", "Lista de itens inválida.")]);
  }

  if (record.items.length > MAX_ITEMS) {
    return fail("INVALID_ITEM", [issue("items", "Máximo de 100 itens.")]);
  }

  const items: ReplaceSetlistItemInput[] = [];
  for (let index = 0; index < record.items.length; index += 1) {
    const parsed = parseReplaceItem(record.items[index], index);
    if ("path" in parsed) {
      issues.push(parsed);
      continue;
    }
    if (
      parsed.kind === "song" &&
      parsed.selectedKey !== undefined &&
      !isTransposableKey(parsed.selectedKey)
    ) {
      return fail("INVALID_KEY", [issue(`items[${index}].selectedKey`, "Tom inválido.")]);
    }
    items.push(parsed);
  }

  if (issues.length > 0) {
    const hasKeyIssue = issues.some((entry) => entry.path.includes("selectedKey"));
    return fail(hasKeyIssue ? "INVALID_KEY" : "INVALID_ITEM", issues);
  }

  return success({ expectedVersion: expectedVersion as number, items });
}

export function parseFollow(body: unknown): SetlistParseResult<FollowSetlistInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const teamId = parseId(record.teamId, "teamId");
  if (typeof teamId !== "string") {
    return fail("INVALID_REQUEST", [teamId]);
  }
  return success({ teamId });
}

export function parseClone(body: unknown): SetlistParseResult<CloneSetlistInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;

  if (record.target === "organization") {
    return success({ target: "organization" });
  }

  if (record.targetTeamId !== undefined) {
    const teamId = parseId(record.targetTeamId, "targetTeamId");
    if (typeof teamId !== "string") {
      return fail("INVALID_REQUEST", [teamId]);
    }
    return success({ targetTeamId: teamId });
  }

  return fail("INVALID_REQUEST", [issue("body", "Destino de clone inválido.")]);
}

export function parseDelete(body: unknown): SetlistParseResult<DeleteSetlistInput> {
  if (typeof body !== "object" || body === null) {
    return fail("INVALID_REQUEST", [issue("body", "JSON inválido.")]);
  }
  const record = body as Record<string, unknown>;
  const expectedVersion = parseExpectedVersion(record.expectedVersion);
  if (typeof expectedVersion !== "number") {
    return fail("INVALID_REQUEST", [expectedVersion]);
  }
  if (record.confirmFollowersImpact !== undefined && typeof record.confirmFollowersImpact !== "boolean") {
    return fail("INVALID_REQUEST", [issue("confirmFollowersImpact", "Confirmação inválida.")]);
  }
  return success({
    expectedVersion,
    ...(record.confirmFollowersImpact === true ? { confirmFollowersImpact: true } : {}),
  });
}
