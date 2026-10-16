import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isCifraClubUrlImportEnabled,
  resetImportModuleConfigForTests,
} from "./import-module-config";

afterEach(() => {
  vi.unstubAllEnvs();
  resetImportModuleConfigForTests();
});

describe("isCifraClubUrlImportEnabled", () => {
  it("is enabled outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isCifraClubUrlImportEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    expect(isCifraClubUrlImportEnabled()).toBe(true);
  });

  it("is disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isCifraClubUrlImportEnabled()).toBe(false);
  });
});
