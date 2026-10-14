// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { createImportSessionToken } from "@/lib/import-access/import-session";
import { resetImportModuleConfigForTests } from "@/lib/import-access/import-module-config";

import ImportPage, { dynamic } from "./page";

const VALID_SECRET = "p".repeat(32);

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  resetImportModuleConfigForTests();
  cookiesMock.mockReset();
});

describe("ImportPage", () => {
  it("throws notFound when the module is disabled", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "false");
    cookiesMock.mockResolvedValue({ getAll: () => [] });

    await expect(ImportPage()).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("shows the unlock screen when the module is configured without a session", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);
    cookiesMock.mockResolvedValue({ getAll: () => [] });

    render(await ImportPage());

    expect(screen.getByRole("button", { name: "Desbloquear" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Texto da cifra")).not.toBeInTheDocument();
  });

  it("shows the import workflow when the session cookie is valid", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    vi.stubEnv("VIDEIRA_IMPORT_ADMIN_SECRET", VALID_SECRET);
    const token = createImportSessionToken(VALID_SECRET);
    cookiesMock.mockResolvedValue({
      getAll: () => [{ name: "videira_import_session", value: token }],
    });

    render(await ImportPage());

    expect(screen.getByLabelText("Texto da cifra")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desbloquear" })).not.toBeInTheDocument();
  });

  it("forces request-time rendering under next start", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
