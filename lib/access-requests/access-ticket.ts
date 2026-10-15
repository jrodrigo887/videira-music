import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { readAuthEnvConfig } from "@/lib/auth/auth-config";
import { normalizeEmail } from "@/lib/auth/email";

export const ACCESS_TICKET_COOKIE = "videira_access_ticket";
const TICKET_TTL_MS = 15 * 60 * 1000;

type TicketPayload = {
  email: string;
  name: string;
  exp: number;
};

function encodePayload(payload: TicketPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): TicketPayload | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TicketPayload;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function signAccessTicket(input: {
  email: string;
  name: string;
  expiresAt?: number;
  now?: number;
}): string {
  const config = readAuthEnvConfig();
  if (!config) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }
  const now = input.now ?? Date.now();
  const payload: TicketPayload = {
    email: normalizeEmail(input.email),
    name: input.name.trim() || input.name,
    exp: input.expiresAt ?? now + TICKET_TTL_MS,
  };
  const encoded = encodePayload(payload);
  const signature = sign(encoded, config.secret);
  return `${encoded}.${signature}`;
}

export function readAccessTicket(
  token: string | undefined,
  now = Date.now(),
): { email: string; name: string } | undefined {
  if (!token) {
    return undefined;
  }
  const config = readAuthEnvConfig();
  if (!config) {
    return undefined;
  }

  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) {
    return undefined;
  }

  const expectedSig = sign(encoded, config.secret);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return undefined;
  }

  const payload = decodePayload(encoded);
  if (!payload || payload.exp <= now) {
    return undefined;
  }

  return { email: normalizeEmail(payload.email), name: payload.name };
}

export function accessTicketCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure?: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
  };
}
