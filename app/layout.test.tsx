// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/font/google", () => ({
  Atkinson_Hyperlegible: () => ({ variable: "--font-lyrics" }),
  JetBrains_Mono: () => ({ variable: "--font-chord" }),
}));

vi.mock("@/lib/import-access/import-module-config", () => ({
  isImportModuleVisibleInUi: () => false,
}));

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import RootLayout from "./layout";

afterEach(() => {
  cleanup();
  getCurrentActorMock.mockReset();
});

describe("RootLayout navigation", () => {
  it("shows Grupos for organization admin", async () => {
    getCurrentActorMock.mockResolvedValue({
      kind: "user",
      userId: "user-admin",
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: "admin",
      teams: [],
    });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/groups");
  });

  it("hides Grupos for non-admin members", async () => {
    getCurrentActorMock.mockResolvedValue({
      kind: "user",
      userId: "user-musician",
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: "member",
      teams: [],
    });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
  });

  it("hides Grupos for anonymous actor", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
  });

  it("falls back to anonymous when actor loading fails", async () => {
    getCurrentActorMock.mockRejectedValue(new Error("database down"));

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setlists" })).toBeInTheDocument();
  });
});
