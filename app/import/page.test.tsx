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

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { resetImportModuleConfigForTests } from "@/lib/import-access/import-module-config";

import ImportPage, { dynamic } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  resetImportModuleConfigForTests();
  getCurrentActorMock.mockReset();
});

describe("ImportPage", () => {
  it("throws notFound when the module is disabled", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "false");
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    await expect(ImportPage()).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("throws notFound when the user is not logged in", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    await expect(ImportPage()).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("shows permission message for musician", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue({
      kind: "user",
      userId: "user-musician",
      organizationId: "org-default",
      roles: ["musician"],
      teams: [],
    });

    render(await ImportPage());

    expect(screen.getByText("Sem permissão para importar.")).toBeInTheDocument();
  });

  it("shows the import workflow for worship leader", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue({
      kind: "user",
      userId: "user-leader",
      organizationId: "org-default",
      roles: ["worship_leader"],
      teams: [],
    });

    render(await ImportPage());

    expect(screen.getByLabelText("Texto da cifra")).toBeInTheDocument();
  });

  it("forces request-time rendering under next start", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
