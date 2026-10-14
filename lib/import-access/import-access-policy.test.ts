import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createImportSessionToken } from "./import-session";
import { canImport } from "./import-access-policy";
import { resetImportModuleConfigForTests } from "./import-module-config";

const VALID_SECRET = "x".repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
  resetImportModuleConfigForTests();
});

function requestWithCookie(token?: string): Request {
  return new Request("http://localhost/", {
    headers: token ? { cookie: `videira_import_session=${token}` } : undefined,
  });
}

describe("canImport", () => {
  it("returns disabled when the module flag is off", () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "false");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);

    expect(canImport(requestWithCookie())).toBe("disabled");
  });

  it("returns disabled when only the legacy flag is set", () => {
    vi.stubEnv("VIDEIRA_ENABLE_CIFRACLUB_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);

    expect(canImport(requestWithCookie())).toBe("disabled");
  });

  it("returns disabled when the secret is too short", () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", "short");

    expect(canImport(requestWithCookie())).toBe("disabled");
  });

  it("returns locked without a valid session cookie", () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);

    expect(canImport(requestWithCookie())).toBe("locked");
  });

  it("returns allowed with a valid session cookie", () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);
    const token = createImportSessionToken(VALID_SECRET);

    expect(canImport(requestWithCookie(token))).toBe("allowed");
  });

  it("returns locked when duplicate session cookies are sent", () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);
    const token = createImportSessionToken(VALID_SECRET);

    const request = new Request("http://localhost/", {
      headers: {
        cookie: `videira_import_session=${token}; videira_import_session=tampered`,
      },
    });

    expect(canImport(request)).toBe("locked");
  });
});
