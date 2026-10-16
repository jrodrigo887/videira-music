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

import { testUserActor } from "@/lib/auth/test-actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import packageJson from "../package.json";

import RootLayout from "./layout";

afterEach(() => {
  cleanup();
  getCurrentActorMock.mockReset();
});

describe("RootLayout navigation", () => {
  it("shows Grupos for organization admin", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-admin",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["admin"],
        teams: [],
      }),
    );

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/groups");
  });

  it("hides Grupos for non-admin members", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["musician"],
        teams: [],
      }),
    );

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
  });

  it("shows Grupos for custom role with teams:manage", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-teams-custom",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["grupos"],
        capabilities: ["teams:manage"],
        teams: [],
      }),
    );

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: "Grupos" })).toBeInTheDocument();
  });

  it("shows Usuários for manager and Importar for worship leader", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-manager",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["manager"],
        teams: [],
      }),
    );
    render(await RootLayout({ children: <p>Conteúdo</p> }));
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/usuarios");

    cleanup();
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-leader",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["worship_leader"],
        teams: [],
      }),
    );
    render(await RootLayout({ children: <p>Conteúdo</p> }));
    expect(screen.getByRole("link", { name: "Importar" })).toHaveAttribute("href", "/import");
    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
  });

  it("hides admin links for musician", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["musician"],
        teams: [],
      }),
    );
    render(await RootLayout({ children: <p>Conteúdo</p> }));
    expect(screen.queryByRole("link", { name: "Importar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grupos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
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

  it("shows the package version", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    render(await RootLayout({ children: <p>Conteúdo</p> }));

    expect(screen.getByRole("link", { name: /Videira Music/ })).toHaveTextContent(`v${packageJson.version}`);
  });
});
