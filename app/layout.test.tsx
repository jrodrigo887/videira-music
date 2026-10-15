// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/font/google", () => ({
  Atkinson_Hyperlegible: () => ({ variable: "--font-lyrics" }),
  JetBrains_Mono: () => ({ variable: "--font-chord" }),
}));

vi.mock("@/lib/auth/auth-actions", () => ({
  signOut: vi.fn(),
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
      roles: ["admin"],
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
      roles: ["musician"],
      teams: [],
    });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
  });

  it("shows Entrar for anonymous actor", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
  });

  it("falls back to anonymous when actor loading fails", async () => {
    getCurrentActorMock.mockRejectedValue(new Error("database down"));

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
  });
});
