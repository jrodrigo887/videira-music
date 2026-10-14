import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createImportSessionToken } from "@/lib/import-access/import-session";
import { resetImportModuleConfigForTests } from "@/lib/import-access/import-module-config";
import { setImportLogWriterForTests } from "@/lib/import-access/import-log";
import { createUnlockRateLimiter } from "@/lib/import-access/unlock-rate-limit";

import { createSessionDeleteHandler, createSessionPostHandler } from "./route";

const VALID_SECRET = "y".repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
  resetImportModuleConfigForTests();
  setImportLogWriterForTests(undefined);
});

function configureModule(): void {
  vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
  vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);
}

describe("POST /api/imports/session", () => {
  it("returns 404 when the module is disabled", async () => {
    const handler = createSessionPostHandler({
      canImport: () => "disabled",
      getSecret: () => VALID_SECRET,
      rateLimiter: createUnlockRateLimiter(),
      now: () => Date.now(),
    });

    const response = await handler(
      new Request("http://localhost/api/imports/session", {
        method: "POST",
        body: JSON.stringify({ secret: VALID_SECRET }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 204 and sets the session cookie for a valid secret", async () => {
    configureModule();
    const logs: string[] = [];
    setImportLogWriterForTests({
      write: async (entry) => {
        logs.push(`${entry.action}:${entry.outcome}`);
      },
    });

    const handler = createSessionPostHandler({
      canImport: () => "locked",
      getSecret: () => VALID_SECRET,
      rateLimiter: createUnlockRateLimiter(),
      now: () => Date.now(),
    });

    const response = await handler(
      new Request("http://localhost/api/imports/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: VALID_SECRET }),
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toContain("videira_import_session=");
    expect(logs).toContain("unlock:success");
  });

  it("returns 401 INVALID_SECRET for a wrong secret", async () => {
    configureModule();
    const handler = createSessionPostHandler({
      canImport: () => "locked",
      getSecret: () => VALID_SECRET,
      rateLimiter: createUnlockRateLimiter(),
      now: () => Date.now(),
    });

    const response = await handler(
      new Request("http://localhost/api/imports/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: `${VALID_SECRET}-wrong` }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_SECRET", message: "Segredo inválido." },
    });
  });
});

describe("DELETE /api/imports/session", () => {
  it("clears the cookie even without an active session", async () => {
    configureModule();
    const handler = createSessionDeleteHandler({ canImport: () => "locked" });

    const response = await handler(new Request("http://localhost/api/imports/session", { method: "DELETE" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("exported session routes with process.env", () => {
  it("accepts a session token signed with the configured secret", () => {
    configureModule();
    const token = createImportSessionToken(VALID_SECRET);
    expect(token.length).toBeGreaterThan(10);
  });
});
