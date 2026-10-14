import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  IMPORT_SESSION_COOKIE,
  IMPORT_SESSION_MAX_AGE_SECONDS,
  IMPORT_SESSION_MAX_DURATION_MS,
} from "./constants";
import { getImportAdminSecret } from "./import-module-config";

export type ImportSessionPayload = {
  issuedAt: number;
  expiresAt: number;
};

type ParsedSessionCookie =
  | { kind: "missing" }
  | { kind: "duplicate" }
  | { kind: "present"; value: string };

function signingKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("videira-import-session-v1").digest();
}

function encodePayload(payload: ImportSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): ImportSessionPayload | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as ImportSessionPayload).issuedAt !== "number" ||
      typeof (parsed as ImportSessionPayload).expiresAt !== "number"
    ) {
      return undefined;
    }
    return parsed as ImportSessionPayload;
  } catch {
    return undefined;
  }
}

export function signImportSession(payload: ImportSessionPayload, secret: string): string {
  const encoded = encodePayload(payload);
  const signature = createHmac("sha256", signingKey(secret)).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyImportSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return false;
  }

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", signingKey(secret)).update(encoded).digest("base64url");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return false;
  }

  const payload = decodePayload(encoded);
  if (!payload) {
    return false;
  }

  const duration = payload.expiresAt - payload.issuedAt;
  if (duration <= 0 || duration > IMPORT_SESSION_MAX_DURATION_MS) {
    return false;
  }

  if (payload.expiresAt <= now) {
    return false;
  }

  return true;
}

export function createImportSessionToken(secret: string, now = Date.now()): string {
  const payload: ImportSessionPayload = {
    issuedAt: now,
    expiresAt: now + IMPORT_SESSION_MAX_DURATION_MS,
  };
  return signImportSession(payload, secret);
}

export function parseImportSessionCookie(cookieHeader: string | null | undefined): ParsedSessionCookie {
  if (!cookieHeader) {
    return { kind: "missing" };
  }

  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${IMPORT_SESSION_COOKIE}=`));

  if (matches.length === 0) {
    return { kind: "missing" };
  }
  if (matches.length > 1) {
    return { kind: "duplicate" };
  }

  const value = matches[0]?.slice(`${IMPORT_SESSION_COOKIE}=`.length);
  if (!value) {
    return { kind: "missing" };
  }
  return { kind: "present", value };
}

export function importSessionCookieHeader(token: string): string {
  return `${IMPORT_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${IMPORT_SESSION_MAX_AGE_SECONDS}`;
}

export function clearImportSessionCookieHeader(): string {
  return `${IMPORT_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function readSessionFromRequest(request: Request): ParsedSessionCookie {
  return parseImportSessionCookie(request.headers.get("cookie"));
}

export function isRequestSessionValid(request: Request, now = Date.now()): boolean {
  const secret = getImportAdminSecret();
  if (!secret) {
    return false;
  }

  const parsed = readSessionFromRequest(request);
  if (parsed.kind !== "present") {
    return false;
  }

  return verifyImportSessionToken(parsed.value, secret, now);
}
